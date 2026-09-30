import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { buildAuthHeaders } from "../utils/authHeaders";
import { API_BASE_URL, readErrorMessage } from "../utils/api";
import { formatPostedDate } from "../utils/format";
import "../css_components/MyPage.css";

// ★新規(C50 機能追加#5)：マイページ。自分が登録した店・メニューと、書いたコメントの一覧。

interface Activity {
  counts: { stores: number; menus: number; comments: number };
  stores: { place_id: string; title: string; created_at: string }[];
  menus: { menu_id: string; menu_name: string; price: number; place_id: string; store_title: string; created_at: string }[];
  comments: { target: "store" | "menu"; place_id: string; store_title: string; menu_name: string; comment: string; posted_at: string }[];
}

type Tab = "stores" | "menus" | "comments";
const TAB_LABELS: Record<Tab, string> = { stores: "登録した店", menus: "登録したメニュー", comments: "書いたコメント" };

interface MyPageProps {
  userName: string | null;
  onNavigate: (view: "store-detail", placeId?: string) => void;
}

export function MyPage({ userName, onNavigate }: MyPageProps) {
  const auth = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("stores");

  // 画面を開いたときに読み込む(状態の更新は読み込み完了後、離れた後の結果は反映しない)
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/users/me/activity`, {
      method: "POST",
      headers: buildAuthHeaders(auth.user?.id_token),
      body: "{}",
    })
      .then(async (res) => (res.ok ? res.json() : Promise.reject(new Error(await readErrorMessage(res)))))
      .then((data) => {
        if (!cancelled) setActivity(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, auth.user?.id_token]);

  if (!auth.isAuthenticated) {
    return (
      <main className="mypage">
        <h2>マイページ</h2>
        <p>ログインするとマイページを見られます。</p>
      </main>
    );
  }

  return (
    <main className="mypage">
      <h2>{userName ? `${userName} さんのマイページ` : "マイページ"}</h2>
      {error && <p role="alert">{error}</p>}
      {!activity && !error && <p>読み込み中...</p>}

      {activity && (
        <>
          {/* 数のまとめ(押すとその一覧に切り替わる) */}
          <div className="mypage__counts">
            {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`mypage__count${tab === key ? " is-selected" : ""}`}
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
              >
                <span className="mypage__count-number">{activity.counts[key]}</span>
                <span className="mypage__count-label">{TAB_LABELS[key]}</span>
              </button>
            ))}
          </div>

          <ul className="mypage__list">
            {tab === "stores" &&
              activity.stores.map((s) => (
                <li key={s.place_id}>
                  <button type="button" className="mypage__item" onClick={() => onNavigate("store-detail", s.place_id)}>
                    <span className="mypage__item-title">{s.title}</span>
                    <span className="mypage__item-meta">登録日 {formatPostedDate(s.created_at)}</span>
                  </button>
                </li>
              ))}
            {tab === "menus" &&
              activity.menus.map((m) => (
                <li key={m.menu_id}>
                  <button type="button" className="mypage__item" onClick={() => onNavigate("store-detail", m.place_id)}>
                    <span className="mypage__item-title">{m.menu_name}</span>
                    <span className="mypage__item-meta">
                      {m.store_title}・¥{m.price.toLocaleString()}・登録日 {formatPostedDate(m.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            {tab === "comments" &&
              activity.comments.map((c, i) => (
                <li key={`${c.place_id}-${c.posted_at}-${i}`}>
                  <button type="button" className="mypage__item" onClick={() => onNavigate("store-detail", c.place_id)}>
                    <span className="mypage__item-title">{c.comment}</span>
                    <span className="mypage__item-meta">
                      {c.target === "menu" ? `${c.store_title}の「${c.menu_name}」へ` : `${c.store_title}へ`}・
                      {formatPostedDate(c.posted_at)}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          {activity[tab].length === 0 && <p className="mypage__empty">まだありません。</p>}
        </>
      )}
    </main>
  );
}
