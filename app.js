const firebaseConfig = {
  apiKey: "AIzaSyDBzOFTiNs9I5zp-LydLseLaMYw_GvvAio",
  authDomain: "scheduler-app-484db.firebaseapp.com",
  projectId: "scheduler-app-484db",
  storageBucket: "scheduler-app-484db.firebasestorage.app",
  messagingSenderId: "752169831087",
  appId: "1:752169831087:web:b108a90e3d39236e44e25a",
  measurementId: "G-C71T30M361"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
let authReadyPromise;

const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m8 15 2.2 2.2L16 12"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

const STAMPS = [
  ["👑", "幹事"],
  ["🚙", "車出し可"],
  ["⚠️", "遅刻注意"],
  ["☀️", "早起き得意"],
  ["🌙", "夜型人間"],
  ["🍴", "食べるの好き"],
  ["🍺", "お酒好き"],
  ["🏠", "インドア派"],
  ["⛰️", "アウトドア派"],
];

const UNIVERSITIES = {
  chubu: {
    name: "中部大学",
    periods: [
      ["1限", "09:00", "10:30"],
      ["2限", "10:40", "12:10"],
      ["3限", "13:10", "14:40"],
      ["4限", "14:50", "16:20"],
      ["5限", "16:30", "18:00"],
      ["6限", "18:10", "19:40"],
    ],
  },
  nagoya: {
    name: "名古屋大学",
    periods: [
      ["1限", "08:45", "10:15"],
      ["2限", "10:30", "12:00"],
      ["3限", "13:00", "14:30"],
      ["4限", "14:45", "16:15"],
      ["5限", "16:30", "18:00"],
      ["6限", "18:15", "19:45"],
    ],
  },
  meijo: {
    name: "名城大学",
    periods: [
      ["1限", "09:10", "10:40"],
      ["2限", "10:50", "12:20"],
      ["3限", "13:10", "14:40"],
      ["4限", "14:50", "16:20"],
      ["5限", "16:30", "18:00"],
    ],
  },
  custom: {
    name: "その他（標準時間）",
    periods: [
      ["1限", "09:00", "10:30"],
      ["2限", "10:40", "12:10"],
      ["3限", "13:00", "14:30"],
      ["4限", "14:40", "16:10"],
      ["5限", "16:20", "17:50"],
    ],
  },
};

const STATUS_CYCLE = ["", "yes", "maybe", "no"];
const STATUS_MARK = { "": "·", yes: "○", maybe: "△", no: "×" };
const STATUS_NAME = { yes: "行ける", maybe: "条件付き", no: "無理" };
const DOW = ["日", "月", "火", "水", "木", "金", "土"];

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const state = {
  eventId: null,
  profile: store.get("awaseru-profile", { name: "", stamps: [], university: "chubu" }),
  schedule: {},
  installPrompt: null,
  currentEvent: null,
};

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(key, withYear = false) {
  const date = parseDate(key);
  return `${withYear ? `${date.getFullYear()}年` : ""}${date.getMonth() + 1}月${date.getDate()}日（${DOW[date.getDay()]}）`;
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function eventDates() {
  const event = state.currentEvent?.id === state.eventId ? state.currentEvent : null;
  return event?.dates || [];
}

function makeEventDates() {
  const start = addDays(new Date(), 2);
  const dates = [];
  for (let i = 0; i < 14; i += 1) dates.push(dateKey(addDays(start, i)));
  return dates;
}

function waitForAuth() {
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(
      async (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
          return;
        }

        try {
          await auth.signInAnonymously();
        } catch (error) {
          unsubscribe();
          reject(error);
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  });

  return authReadyPromise;
}

function firebaseErrorMessage(error) {
  const code = error?.code || "";
  if (code === "auth/operation-not-allowed") {
    return "Firebase Authenticationで匿名認証を有効にしてください。";
  }
  if (code === "auth/unauthorized-domain") {
    return "Firebase Authenticationの承認済みドメインに、このサイトのドメインを追加してください。";
  }
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Firestoreのセキュリティルールでアクセスが拒否されました。";
  }
  if (code === "unavailable" || code === "firestore/unavailable") {
    return "Firebaseへ接続できません。通信環境を確認してください。";
  }
  return error?.message || "Firebaseの初期化に失敗しました。";
}

function createSampleEvent() {
  const dates = makeEventDates();
  const sampleNames = [
    ["たろう", "👑"],
    ["はなこ", "☀️"],
    ["けんた", "🚙"],
    ["ゆうき", "🌙"],
  ];
  const participants = sampleNames.map(([name, stamp], index) => ({
    id: `sample-${index}`,
    name,
    stamps: [stamp],
    availability: Object.fromEntries(
      dates.map((date, dateIndex) => {
        const available = (dateIndex + index) % 4 !== 2;
        const start = 9 + ((dateIndex + index) % 5);
        return [
          date,
          {
            status: available ? ((dateIndex + index) % 5 === 0 ? "maybe" : "yes") : "no",
            mode: "time",
            ranges: available
              ? [
                  {
                    start: `${String(start).padStart(2, "0")}:00`,
                    end: `${String(Math.min(start + 4, 21)).padStart(2, "0")}:00`,
                  },
                ]
              : [],
          },
        ];
      }),
    ),
  }));

  return {
    id: "trip2026",
    name: "夏休み旅行の予定調整",
    description: "みんなで行く旅行の日程を決めよう。空いている日と時間を教えてください！",
    dates,
    createdAt: new Date().toISOString(),
    participants,
    isSample: true,
  };
}

async function ensureSampleEvent(user) {
  const ref = db.collection("events").doc("trip2026");
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await ref.set({
      ...createSampleEvent(),
      ownerId: user.uid,
      updatedAt: new Date().toISOString(),
    });
  }
}

async function getEvent(id) {
  try {
    if (state.currentEvent?.id === id) return state.currentEvent;
    await waitForAuth();
    const doc = await db.collection("events").doc(id).get();
    if (doc.exists) {
      state.currentEvent = { ...doc.data(), id: doc.id };
      return state.currentEvent;
    }
    return null;
  } catch (error) {
    console.error("イベント取得エラー:", error);
    throw error;
  }
}

async function saveEvent(event) {
  try {
    const user = await waitForAuth();
    const data = {
      ...event,
      ownerId: event.ownerId || user.uid,
      updatedAt: new Date().toISOString(),
    };
    await db.collection("events").doc(event.id).set(data);
    state.currentEvent = data;
    return data;
  } catch (error) {
    console.error("イベント保存エラー:", error);
    throw error;
  }
}

async function upsertParticipant(eventId, participant) {
  await waitForAuth();
  const ref = db.collection("events").doc(eventId);

  const updatedEvent = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new Error("イベントが見つかりません。");

    const event = { ...snapshot.data(), id: snapshot.id };
    const participants = Array.isArray(event.participants) ? [...event.participants] : [];
    const existingIndex = participants.findIndex(
      (item) => item.name === participant.name && !String(item.id).startsWith("sample"),
    );

    if (existingIndex >= 0) participants[existingIndex] = participant;
    else participants.push(participant);

    transaction.update(ref, {
      participants,
      updatedAt: new Date().toISOString(),
    });

    return { ...event, participants };
  });

  state.currentEvent = updatedEvent;
  return updatedEvent;
}

function makeId() {
  return Math.random().toString(36).slice(2, 8);
}

function shell(content, options = {}) {
  const { narrow = false, headerAction = "" } = options;
  return `
    <div class="app-shell">
      <header class="site-header">
        <a class="brand" href="#/">
          <span class="brand-mark">${ICONS.calendar}</span>
          <span>あわせる</span>
        </a>
        ${headerAction}
      </header>
      <main class="page ${narrow ? "narrow" : ""}">${content}</main>
      <footer class="site-footer">© 2026 あわせる</footer>
    </div>
  `;
}

function icon(name) {
  return `<span class="icon">${ICONS[name]}</span>`;
}

function stepper(active) {
  return `
    <div class="stepper" aria-label="入力ステップ">
      ${["プロフィール", "スケジュール", "完了"]
        .map(
          (label, index) => `
            <div class="step ${index + 1 <= active ? "active" : ""}">
              <span class="step-dot">${index + 1}</span>
              <span>${label}</span>
            </div>`,
        )
        .join("")}
    </div>
  `;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function navigate(path) {
  location.hash = path;
}

function homeView() {
  return shell(`
    <div class="hero-grid">
      <section class="hero-copy">
        <span class="eyebrow">${icon("spark")} 学生の予定調整を、もっと軽やかに</span>
        <h1>違う時間割でも、<br><span>空き時間は合う。</span></h1>
        <p>大学ごとに違う「3限」「4限」を実際の時刻へ自動変換。みんなが集まれる時間を、迷わず見つけられます。</p>
        <div class="benefit-list">
          <div class="benefit"><span class="icon">${ICONS.calendar}</span>コマ時間と時刻入力、どちらにも対応</div>
          <div class="benefit"><span class="icon">${ICONS.users}</span>アカウント登録なしで、URLからすぐ参加</div>
          <div class="benefit"><span class="icon">${ICONS.spark}</span>全員の空きを重ねて候補を自動提案</div>
        </div>
      </section>
      <section class="card create-card">
        <h2 class="card-title">新しいイベントを作成</h2>
        <p class="card-subtitle">イベント情報を入力すると、参加者へ送れるURLを発行します。</p>
        <form id="create-form">
          <div class="field">
            <label for="event-name">イベント名</label>
            <input id="event-name" name="name" required maxlength="50" placeholder="例）サークル旅行、夏の飲み会" />
          </div>
          <div class="field">
            <label for="event-description">ひとこと説明</label>
            <textarea id="event-description" name="description" maxlength="140" placeholder="日程や目的を簡単に書いておくと親切です"></textarea>
          </div>
          <button class="primary-button full-button" type="submit">${icon("link")} 共有URLを発行する</button>
        </form>
        <a class="demo-link" href="#/e/trip2026">
          <span><strong>サンプルイベントを見る</strong><small>参加から集計まで、すぐに試せます</small></span>
          ${icon("arrow")}
        </a>
      </section>
    </div>
  `);
}

function welcomeView(event) {
  return shell(
    `
      <section class="card welcome-hero">
        <div class="welcome-art">
          <div class="people-art" aria-hidden="true">
            <span class="person"></span><span class="person"></span><span class="person"></span><span class="person"></span>
          </div>
        </div>
        <div class="welcome-content center">
          <span class="eyebrow">＼ 予定調整に招待されています ／</span>
          <h1>みんなの予定を合わせよう</h1>
          <p>入力は約1分。アカウント登録は必要ありません。</p>
          <div class="event-panel">
            <h2>${escapeHtml(event.name)}</h2>
            <p>${escapeHtml(event.description || "空いている日と時間を入力してください。")}</p>
            <div class="event-meta">
              <div class="meta-item">現在 <strong>${event.participants.length}人</strong> が参加中</div>
              <div class="meta-item">入力時間 <strong>約1分</strong></div>
            </div>
            <button class="primary-button full-button" id="join-button">参加して予定を入力する ${icon("arrow")}</button>
          </div>
          <div class="feature-strip">
            <div class="feature-mini"><span class="feature-symbol yes">○</span>行ける日を選ぶ</div>
            <div class="feature-mini"><span class="feature-symbol" style="color:var(--orange)">△</span>条件付きの日を選ぶ</div>
            <div class="feature-mini"><span class="feature-symbol">×</span>難しい日を選ぶ</div>
          </div>
        </div>
      </section>
      <aside class="install-banner">
        <span><strong>ホーム画面に追加できます</strong><small>次回からワンタップで開けて便利です</small></span>
        <button class="ghost-button" id="install-button">追加方法を見る</button>
      </aside>
    `,
    { narrow: true },
  );
}

function profileView(event) {
  return shell(
    `
      ${stepper(1)}
      <section class="card form-card">
        <div class="screen-heading">
          <div>
            <h1>プロフィール設定</h1>
            <p>このイベントで表示する名前と、あなたの大学を教えてください。</p>
          </div>
        </div>
        <form id="profile-form">
          <div class="field">
            <label for="profile-name">表示名</label>
            <input id="profile-name" name="name" required maxlength="20" value="${escapeAttr(state.profile.name)}" placeholder="ニックネームでOK" />
          </div>
          <span class="label">スタンプを選択 <small style="color:var(--muted);font-weight:500">（複数選択可）</small></span>
          <div class="stamp-grid">
            ${STAMPS.map(
              ([emoji, label]) => `
                <button class="stamp-option ${state.profile.stamps.includes(emoji) ? "selected" : ""}" type="button" data-stamp="${emoji}">
                  <span class="stamp-emoji">${emoji}</span><span>${label}</span>
                </button>`,
            ).join("")}
          </div>
          <div class="field">
            <label for="university">所属大学</label>
            <select id="university" name="university">
              ${Object.entries(UNIVERSITIES)
                .map(
                  ([id, university]) =>
                    `<option value="${id}" ${state.profile.university === id ? "selected" : ""}>${university.name}</option>`,
                )
                .join("")}
            </select>
          </div>
          <div class="notice">選んだ大学のコマ時間を、結果画面では共通の実時間へ自動変換します。</div>
          <div class="action-row">
            <button type="button" class="secondary-button" data-back>戻る</button>
            <button type="submit" class="primary-button">スケジュール入力へ ${icon("arrow")}</button>
          </div>
        </form>
      </section>
    `,
    { narrow: true },
  );
}

function calendarCells(dates) {
  const first = parseDate(dates[0]);
  const start = addDays(first, -first.getDay());
  const last = parseDate(dates[dates.length - 1]);
  const finish = addDays(last, 6 - last.getDay());
  const cells = [];
  for (let day = new Date(start); day <= finish; day = addDays(day, 1)) {
    const key = dateKey(day);
    const active = dates.includes(key);
    const status = state.schedule[key]?.status || "";
    cells.push(`
      <button
        class="date-button ${active ? "" : "outside"}"
        type="button"
        data-date="${key}"
        data-status="${status}"
        aria-label="${formatDate(key)} ${status ? STATUS_NAME[status] : "未選択"}"
      >
        <span class="date-number">${day.getDate()}</span>
        <span class="date-status">${STATUS_MARK[status]}</span>
      </button>
    `);
  }
  return cells.join("");
}

function calendarView(event) {
  const dates = event.dates;
  const first = parseDate(dates[0]);
  const selected = dates.filter((key) => ["yes", "maybe"].includes(state.schedule[key]?.status)).length;
  return shell(
    `
      ${stepper(2)}
      <div class="screen-heading">
        <div><h1>行ける日を選択</h1><p>日付をタップすると「○ → △ → ×」の順に切り替わります。</p></div>
        <button class="header-action" id="show-results">現在の結果を見る</button>
      </div>
      <section class="card calendar-card">
        <div class="calendar-month">
          <span></span>
          <h2>${first.getFullYear()}年${first.getMonth() + 1}月</h2>
          <span></span>
        </div>
        <div class="calendar-grid">
          ${["日", "月", "火", "水", "木", "金", "土"]
            .map((day, index) => `<div class="weekday ${index === 0 ? "sun" : index === 6 ? "sat" : ""}">${day}</div>`)
            .join("")}
          ${calendarCells(dates)}
        </div>
        <div class="legend">
          <span><b class="yes">○</b> 行ける</span><span><b class="maybe">△</b> 条件付き</span><span><b>×</b> 無理</span>
        </div>
        <div class="calendar-hint"><strong>${selected}日を詳細入力の対象に選択中。</strong> ○・△の日は、次の画面でコマまたは時刻を指定できます。</div>
        <div class="action-row">
          <button type="button" class="secondary-button" data-back>戻る</button>
          <button type="button" class="primary-button" id="calendar-next" ${selected ? "" : "disabled"}>詳細時間を入力 ${icon("arrow")}</button>
        </div>
      </section>
    `,
    { narrow: true },
  );
}

function periodEditor(key, entry) {
  const university = UNIVERSITIES[state.profile.university] || UNIVERSITIES.custom;
  return `
    <div class="period-list">
      ${university.periods
        .map(
          ([name, start, end], index) => `
            <label class="period-option">
              <span class="period-name"><input type="checkbox" data-period="${index}" data-date="${key}" ${entry.periods?.includes(index) ? "checked" : ""}> ${name}</span>
              <span class="period-time">${start} - ${end}</span>
            </label>`,
        )
        .join("")}
    </div>
  `;
}

function timeEditor(key, entry) {
  const range = entry.ranges?.[0] || { start: "10:00", end: "18:00" };
  const options = [];
  for (let hour = 8; hour <= 22; hour += 1) {
    const value = `${String(hour).padStart(2, "0")}:00`;
    options.push(value);
  }
  return `
    <div class="time-range">
      <div class="field"><label>開始</label><select class="time-select" data-time="start" data-date="${key}">${options.map((v) => `<option ${v === range.start ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <span>〜</span>
      <div class="field"><label>終了</label><select class="time-select" data-time="end" data-date="${key}">${options.map((v) => `<option ${v === range.end ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    </div>
  `;
}

function detailsView(event) {
  const selected = event.dates.filter((key) => ["yes", "maybe"].includes(state.schedule[key]?.status));
  return shell(
    `
      ${stepper(2)}
      <div class="screen-heading">
        <div><h1>空いている時間を入力</h1><p>日ごとに「コマ単位」と「時間単位」を切り替えられます。</p></div>
      </div>
      <div id="day-editors">
        ${selected
          .map((key) => {
            const entry = state.schedule[key];
            entry.mode ||= "period";
            entry.periods ||= [];
            entry.ranges ||= [{ start: "10:00", end: "18:00" }];
            return `
              <section class="card day-editor" data-editor="${key}">
                <div class="day-editor-header">
                  <div><h3>${formatDate(key, true)}</h3><span class="status-pill ${entry.status}">${STATUS_MARK[entry.status]} ${STATUS_NAME[entry.status]}</span></div>
                  <div class="mode-switch">
                    <button type="button" class="${entry.mode === "period" ? "active" : ""}" data-mode="period" data-date="${key}">コマ単位</button>
                    <button type="button" class="${entry.mode === "time" ? "active" : ""}" data-mode="time" data-date="${key}">時間単位</button>
                  </div>
                </div>
                <div class="day-editor-body">
                  <span class="label">${entry.mode === "period" ? `${UNIVERSITIES[state.profile.university].name}の空きコマ` : "空いている時間帯"}</span>
                  ${entry.mode === "period" ? periodEditor(key, entry) : timeEditor(key, entry)}
                </div>
              </section>`;
          })
          .join("")}
      </div>
      <div class="action-row">
        <button type="button" class="secondary-button" data-back>カレンダーへ</button>
        <button type="button" class="primary-button" id="details-next">入力内容を確認 ${icon("arrow")}</button>
      </div>
    `,
    { narrow: true },
  );
}

function entryRanges(entry) {
  if (entry.status === "no") return [];
  if (entry.mode === "time") return entry.ranges || [];
  const university = UNIVERSITIES[state.profile.university] || UNIVERSITIES.custom;
  return (entry.periods || []).map((index) => {
    const [, start, end] = university.periods[index];
    return { start, end };
  });
}

function reviewView(event) {
  const entries = event.dates.filter((key) => state.schedule[key]?.status);
  return shell(
    `
      ${stepper(2)}
      <section class="card form-card">
        <div class="screen-heading">
          <div><h1>入力内容の確認</h1><p>この内容で「${escapeHtml(event.name)}」に回答します。</p></div>
        </div>
        <div class="review-list">
          ${entries
            .map((key) => {
              const entry = state.schedule[key];
              const ranges = entryRanges(entry);
              return `
                <div class="review-day">
                  <strong><span class="status-pill ${entry.status}">${STATUS_MARK[entry.status]} ${STATUS_NAME[entry.status]}</span> ${formatDate(key, true)}</strong>
                  <p>${entry.status === "no" ? "参加できません" : ranges.length ? ranges.map((range) => `${range.start} - ${range.end}`).join("、") : "時間は未指定（終日として回答）"}</p>
                </div>`;
            })
            .join("")}
        </div>
        <div class="action-row">
          <button type="button" class="secondary-button" data-back>修正する</button>
          <button type="button" class="primary-button" id="submit-schedule">この内容で提出する</button>
        </div>
      </section>
    `,
    { narrow: true },
  );
}

function participantRanges(participant, key) {
  const entry = participant.availability[key];
  if (!entry || entry.status === "no") return [];
  return entry.ranges?.length ? entry.ranges : [{ start: "08:00", end: "22:00" }];
}

function timeToHour(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour + minute / 60;
}

function scoresForEvent(event) {
  return event.dates
    .map((key) => {
      const slots = [];
      for (let hour = 8; hour < 22; hour += 1) {
        let yes = 0;
        let maybe = 0;
        event.participants.forEach((participant) => {
          const entry = participant.availability[key];
          if (!entry) return;
          const covers = participantRanges(participant, key).some(
            (range) => timeToHour(range.start) <= hour && timeToHour(range.end) >= hour + 1,
          );
          if (covers && entry.status === "yes") yes += 1;
          if (covers && entry.status === "maybe") maybe += 1;
        });
        slots.push({ hour, yes, maybe, score: yes + maybe * 0.55 });
      }
      const best = slots.sort((a, b) => b.score - a.score)[0] || { hour: 10, yes: 0, maybe: 0, score: 0 };
      const total = Math.max(event.participants.length, 1);
      return {
        key,
        start: `${String(best.hour).padStart(2, "0")}:00`,
        end: `${String(best.hour + 2).padStart(2, "0")}:00`,
        score: Math.round((best.score / total) * 100),
        yes: best.yes,
        maybe: best.maybe,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function timelineRow(participant, key) {
  const entry = participant.availability[key];
  const ranges = participantRanges(participant, key);
  const stamp = participant.stamps?.[0] || "🙂";
  const bars = ranges
    .map((range) => {
      const start = Math.max(8, timeToHour(range.start));
      const end = Math.min(22, timeToHour(range.end));
      const columnStart = 2 + (start - 8);
      const columnEnd = 2 + (end - 8);
      return `<span class="availability ${entry?.status === "maybe" ? "maybe" : ""}" style="grid-column:${columnStart} / ${columnEnd}"></span>`;
    })
    .join("");
  return `
    <div class="person-row">
      <span class="person-label"><span class="avatar">${stamp}</span>${escapeHtml(participant.name)}</span>
      ${bars}
    </div>`;
}

function resultsView(event, selectedDate = null) {
  const scores = scoresForEvent(event);
  const timelineDate = selectedDate || scores[0]?.key || event.dates[0];
  const medals = ["👑", "🥈", "🥉"];
  return shell(`
    <div class="screen-heading">
      <div><span class="eyebrow">${icon("spark")} 集計結果</span><h1>${escapeHtml(event.name)}</h1><p>${event.participants.length}人の回答を実時間へ変換して重ねています。</p></div>
      <button class="secondary-button" id="answer-again">自分の予定を入力</button>
    </div>
    <div class="result-layout">
      <section class="card ranking-card">
        <h2 class="card-title">おすすめ候補日時</h2>
        <p class="card-subtitle">みんなが集まりやすいトップ3</p>
        <div class="ranking-list">
          ${scores
            .slice(0, 3)
            .map(
              (score, index) => `
              <article class="rank-item">
                <span class="rank-medal">${medals[index]}</span>
                <div>
                  <div class="rank-date">${formatDate(score.key)}</div>
                  <div class="rank-time">${score.start} - ${score.end}</div>
                  <div class="score-row"><span class="score-bar"><span style="width:${score.score}%"></span></span><b>合致 ${score.score}%</b></div>
                </div>
              </article>`,
            )
            .join("")}
        </div>
        <div class="share-card">
          <input id="share-url" readonly value="${escapeAttr(`${location.origin}${location.pathname}#/e/${event.id}`)}" />
          <button class="primary-button" id="copy-url">URLをコピー</button>
        </div>
      </section>
      <section class="card timeline-card">
        <div class="timeline-head">
          <div><h2 class="card-title">みんなの空き時間</h2><p class="card-subtitle" style="margin:0">実時間タイムライン</p></div>
          <select class="timeline-date-select" id="timeline-date">
            ${scores.map((score) => `<option value="${score.key}" ${score.key === timelineDate ? "selected" : ""}>${formatDate(score.key)}</option>`).join("")}
          </select>
        </div>
        <div class="timeline">
          <div class="timeline-inner">
            <div class="time-axis"><span>名前</span>${Array.from({ length: 14 }, (_, index) => `<span>${String(index + 8).padStart(2, "0")}:00</span>`).join("")}</div>
            ${event.participants.length ? event.participants.map((participant) => timelineRow(participant, timelineDate)).join("") : '<div class="empty-state">まだ回答がありません</div>'}
          </div>
        </div>
        <div class="legend"><span><b class="yes">■</b> 行ける</span><span><b class="maybe">■</b> 条件付き</span></div>
      </section>
    </div>
  `);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function bindCommon() {
  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => history.back());
  });
}

function bindHome() {
  document.querySelector("#create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const form = new FormData(event.currentTarget);
    const id = makeId();
    const newEvent = {
      id,
      name: form.get("name").trim(),
      description: form.get("description").trim(),
      dates: makeEventDates(),
      createdAt: new Date().toISOString(),
      participants: [],
    };
    try {
      await saveEvent(newEvent);
      state.eventId = id;
      navigate(`/e/${id}`);
    } catch (error) {
      showToast(firebaseErrorMessage(error));
      submitButton.disabled = false;
    }
  });
}

function bindWelcome(event) {
  document.querySelector("#join-button")?.addEventListener("click", () => navigate(`/e/${event.id}/profile`));
  document.querySelector("#install-button")?.addEventListener("click", async () => {
    if (state.installPrompt) {
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
    } else {
      showToast("ブラウザのメニューから「ホーム画面に追加」を選べます");
    }
  });
}

function bindProfile(event) {
  document.querySelectorAll(".stamp-option").forEach((button) => {
    button.addEventListener("click", () => {
      const stamp = button.dataset.stamp;
      button.classList.toggle("selected");
      if (state.profile.stamps.includes(stamp)) {
        state.profile.stamps = state.profile.stamps.filter((item) => item !== stamp);
      } else {
        state.profile.stamps.push(stamp);
      }
    });
  });
  document.querySelector("#profile-form")?.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    const form = new FormData(submitEvent.currentTarget);
    state.profile.name = form.get("name").trim();
    state.profile.university = form.get("university");
    store.set("awaseru-profile", state.profile);
    navigate(`/e/${event.id}/calendar`);
  });
}

function bindCalendar(event) {
  document.querySelectorAll(".date-button:not(.outside)").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.date;
      const current = state.schedule[key]?.status || "";
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
      if (!next) {
        delete state.schedule[key];
      } else {
        state.schedule[key] = { ...(state.schedule[key] || {}), status: next };
      }
      render();
    });
  });
  document.querySelector("#calendar-next")?.addEventListener("click", () => navigate(`/e/${event.id}/details`));
  document.querySelector("#show-results")?.addEventListener("click", () => navigate(`/e/${event.id}/results`));
}

function bindDetails(event) {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.schedule[button.dataset.date].mode = button.dataset.mode;
      render();
    });
  });
  document.querySelectorAll("[data-period]").forEach((input) => {
    input.addEventListener("change", () => {
      const entry = state.schedule[input.dataset.date];
      const period = Number(input.dataset.period);
      entry.periods = entry.periods || [];
      entry.periods = input.checked ? [...new Set([...entry.periods, period])] : entry.periods.filter((item) => item !== period);
    });
  });
  document.querySelectorAll("[data-time]").forEach((select) => {
    select.addEventListener("change", () => {
      const entry = state.schedule[select.dataset.date];
      entry.ranges ||= [{ start: "10:00", end: "18:00" }];
      entry.ranges[0][select.dataset.time] = select.value;
    });
  });
  document.querySelector("#details-next")?.addEventListener("click", () => navigate(`/e/${event.id}/review`));
}

function bindReview(event) {
  document.querySelector("#submit-schedule")?.addEventListener("click", async (clickEvent) => {
    clickEvent.currentTarget.disabled = true;
    const participant = {
      id: makeId(),
      name: state.profile.name,
      stamps: state.profile.stamps,
      availability: Object.fromEntries(
        Object.entries(state.schedule).map(([key, entry]) => [key, { ...entry, ranges: entryRanges(entry) }]),
      ),
    };
    try {
      await upsertParticipant(event.id, participant);
      showToast("予定を提出しました");
      navigate(`/e/${event.id}/results`);
    } catch (error) {
      showToast(firebaseErrorMessage(error));
      clickEvent.currentTarget.disabled = false;
    }
  });
}

function bindResults(event) {
  document.querySelector("#timeline-date")?.addEventListener("change", (changeEvent) => {
    app.innerHTML = resultsView(event, changeEvent.target.value);
    bindCommon();
    bindResults(event);
  });
  document.querySelector("#copy-url")?.addEventListener("click", async () => {
    const value = document.querySelector("#share-url").value;
    try {
      await navigator.clipboard.writeText(value);
      showToast("共有URLをコピーしました");
    } catch {
      document.querySelector("#share-url").select();
      showToast("URLを選択しました");
    }
  });
  document.querySelector("#answer-again")?.addEventListener("click", () => {
    state.schedule = {};
    navigate(`/e/${event.id}/profile`);
  });
}

function renderNotFound() {
  app.innerHTML = shell(
    `<section class="card form-card center"><h1>イベントが見つかりません</h1><p class="card-subtitle">URLが正しいか確認するか、新しいイベントを作成してください。</p><a class="primary-button" href="#/">トップへ戻る</a></section>`,
    { narrow: true },
  );
}

function renderFirebaseError(error) {
  app.innerHTML = shell(
    `<section class="card form-card center">
      <h1>Firebaseに接続できませんでした</h1>
      <p class="card-subtitle">${escapeHtml(firebaseErrorMessage(error))}</p>
      <button class="primary-button" id="retry-firebase">再試行する</button>
    </section>`,
    { narrow: true },
  );
  document.querySelector("#retry-firebase")?.addEventListener("click", () => location.reload());
}

async function render() {
  const path = location.hash.slice(1) || "/";
  const match = path.match(/^\/e\/([^/]+)(?:\/([^/]+))?$/);
  let binder = bindHome;
  if (path === "/") {
    app.innerHTML = homeView();
  } else if (match) {
    const [, id, screen = "welcome"] = match;
    const event = await getEvent(id);
    if (!event) {
      renderNotFound();
      return;
    }
    state.eventId = id;
    if (screen === "welcome") {
      app.innerHTML = welcomeView(event);
      binder = () => bindWelcome(event);
    } else if (screen === "profile") {
      app.innerHTML = profileView(event);
      binder = () => bindProfile(event);
    } else if (screen === "calendar") {
      app.innerHTML = calendarView(event);
      binder = () => bindCalendar(event);
    } else if (screen === "details") {
      app.innerHTML = detailsView(event);
      binder = () => bindDetails(event);
    } else if (screen === "review") {
      app.innerHTML = reviewView(event);
      binder = () => bindReview(event);
    } else if (screen === "results") {
      app.innerHTML = resultsView(event);
      binder = () => bindResults(event);
    } else {
      renderNotFound();
      return;
    }
  } else {
    renderNotFound();
    return;
  }
  bindCommon();
  binder();
  window.scrollTo({ top: 0, behavior: "instant" });
}

async function renderSafely() {
  try {
    await render();
  } catch (error) {
    console.error("画面表示エラー:", error);
    renderFirebaseError(error);
  }
}

async function bootstrap() {
  try {
    const user = await waitForAuth();
    try {
      await ensureSampleEvent(user);
    } catch (error) {
      console.warn("サンプルイベントを準備できませんでした:", error);
    }
    await render();
  } catch (error) {
    console.error("Firebase初期化エラー:", error);
    renderFirebaseError(error);
  }
}

window.addEventListener("hashchange", renderSafely);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.installPrompt = event;
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

bootstrap();
