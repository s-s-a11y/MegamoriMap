import { useCallback, useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { buildAuthHeaders } from "../utils/authHeaders";
import { API_BASE_URL, readErrorMessage } from "../utils/api";
import { formatDateTime } from "../utils/format";
import "../css_components/AdminPage.css";

// ★新規(C51 機能追加#5)：管理者ページ。管理者グループ(megamorimap-admin)の人だけが開ける。
// 管理者かどうかは Lambda(Admin) 側でも必ず確認している(画面の表示を変えただけでは使えない)

type Tab = "closed" | "deleted" | "users";
const TAB_LABELS: Record<Tab, string> = { closed: "閉業報告", deleted: "削除した店", users: "利用者" };

interface Summary {
  stores: number; deleted_stores: number; menus: number; comments: number;
  users: number; wishes: number; closed_reports: number;
}
interface ClosedItem { place_id: string; title: string; reported_by_name: string; reported_at: string }
interface DeletedItem { place_id: string; title: string; created_by_name: string; created_at: string; deleted_at: string }
interface UserItem { user_name: string; stores: number; menus: number; comments: number }

const SUMMARY_LABELS: [keyof Summary, string][] = [
  ["stores", "店舗"], ["menus", "メニュー"], ["comments", "コメント"], ["users", "利用者"],
  ["wishes", "行ってみたい"], ["closed_reports", "閉業報告"], ["deleted_stores", "削除した店"],
];

export function AdminPage() {
  const auth = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<Tab>("closed");
  const [closed, setClosed] = useState<ClosedItem[] | null>(null);
  const [deleted, setDeleted] = useState<DeletedItem[] | null>(null);
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const call = useCallback(
    async (body: object) => {
      const res = await fetch(`${API_BASE_URL}/admin`, {
        method: "POST",
        headers: buildAuthHeaders(auth.user?.id_token),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return res.json();
    },
    [auth.user?.id_token],
  );

  // 数字と3つの一覧を読み込む(取り消し・復元の後は reloadKey を変えて読み直す)
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    Promise.all([
      call({ action: "summary" }),
      call({ action: "closed_places" }),
      call({ action: "deleted_stores" }),
      call({ action: "users" }),
    ])
      .then(([s, c, d, u]) => {
        if (cancelled) return;
        setSummary(s);
        setClosed(c.items ?? []);
        setDeleted(d.items ?? []);
        setUsers(u.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, call, reloadKey]);

  const runAction = async (key: string, confirmText: string, body: object) => {
    if (!window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    try {
      await call(body);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "処理に失敗しました");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="admin">
      {/* ★変更(C65)：見出しに説明を添える */}
      <header>
        <h2>管理者ページ</h2>
        <p>アプリ全体の数字の確認と、閉業報告・削除した店の管理ができます</p>
      </header>
      {error && <p role="alert">{error}</p>}
      {!summary && !error && <p>読み込み中...</p>}

      {summary && (
        <div className="admin__summary">
          {SUMMARY_LABELS.map(([key, label]) => (
            <div key={key} className="admin__stat">
              <span className="admin__stat-number">{summary[key]}</span>
              <span className="admin__stat-label">{label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="admin__tabs" role="tablist">
        {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`admin__tab${tab === key ? " is-selected" : ""}`}
            onClick={() => setTab(key)}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {tab === "closed" && closed && (
        <table className="admin__table">
          <thead><tr><th>店名</th><th>報告者</th><th>報告日時</th><th></th></tr></thead>
          <tbody>
            {closed.map((c) => (
              <tr key={c.place_id}>
                <td>{c.title || "(店名なし)"}</td>
                <td>{c.reported_by_name}</td>
                <td>{formatDateTime(c.reported_at)}</td>
                <td>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => runAction(c.place_id, `「${c.title}」の閉業報告を取り消しますか？\n行ってみたい店の候補に再び出るようになります。`, { action: "cancel_closed", place_id: c.place_id })}
                  >
                    {busy === c.place_id ? "処理中..." : "取り消す"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === "closed" && closed?.length === 0 && <p className="admin__empty">閉業報告はありません。</p>}

      {tab === "deleted" && deleted && (
        <table className="admin__table">
          <thead><tr><th>店名</th><th>登録者</th><th>削除日時</th><th></th></tr></thead>
          <tbody>
            {deleted.map((d) => (
              <tr key={d.place_id}>
                <td>{d.title}</td>
                <td>{d.created_by_name}</td>
                <td>{d.deleted_at ? formatDateTime(d.deleted_at) : "記録なし"}</td>
                <td>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => runAction(d.place_id, `「${d.title}」を元に戻しますか？\n店と一緒に削除されたメニューも戻ります。`, { action: "restore_store", place_id: d.place_id })}
                  >
                    {busy === d.place_id ? "処理中..." : "元に戻す"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tab === "deleted" && deleted?.length === 0 && <p className="admin__empty">削除した店はありません。</p>}
      {tab === "deleted" && deleted && deleted.length > 0 && (
        <p className="admin__note">※「記録なし」は削除日時を残すようにする前に削除された店です。元に戻すと、その店の削除済みメニューもすべて戻ります。</p>
      )}

      {tab === "users" && users && (
        <table className="admin__table">
          <thead><tr><th>ユーザー名</th><th>店</th><th>メニュー</th><th>コメント</th></tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={`${u.user_name}-${i}`}>
                <td>{u.user_name}</td>
                <td>{u.stores}</td>
                <td>{u.menus}</td>
                <td>{u.comments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
