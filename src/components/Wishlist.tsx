import { useCallback, useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { buildAuthHeaders } from "../utils/authHeaders";
import { API_BASE_URL, readErrorMessage } from "../utils/api";
import { formatWalk } from "../utils/format";
import "../css_components/Wishlist.css";

// ★新規(機能追加#4)：行ってみたい店リスト。
// 上段で昼/晩を選んで会社から徒歩10分以内の未登録の店を5件提案し、下段に自分のリストを表示する。

type MealTime = "lunch" | "dinner";
type Status = "idle" | "loading" | "success" | "error";

const MEAL_TIME_LABELS: Record<MealTime, string> = { lunch: "昼", dinner: "晩" };

interface Candidate {
  place_id: string;
  title: string;
  address_label: string;
  category_name: string;
  longitude: number;
  latitude: number;
  walk_minutes: number;
  walk_distance_m: number;
}

interface WishlistItem {
  place_id: string;
  title: string;
  address_label: string;
  category_name: string;
  meal_time: MealTime;
  longitude: number;
  latitude: number;
  created_at: string;
  // 後から誰かに店舗登録された店は true(店舗詳細へのリンクに切り替える)
  registered: boolean;
  walk_minutes: number | null;
  walk_distance_m: number | null;
}

// 店舗登録画面に引き継ぐ店の情報(店舗検索APIの結果と同じ形)
export interface WishlistRegistPreset {
  place: {
    PlaceId: string;
    Title: string;
    Address: { Label: string };
    Position: [number, number];
  };
  mealTime: MealTime;
}

interface WishlistPageProps {
  onNavigate: (view: "store-detail", placeId?: string) => void;
  onRegistStore: (preset: WishlistRegistPreset) => void;
}

export function WishlistPage({ onNavigate, onRegistStore }: WishlistPageProps) {
  const auth = useAuth();
  const idToken = auth.user?.id_token;

  // ---- 候補 ----
  const [mealTime, setMealTime] = useState<MealTime>("lunch");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateStatus, setCandidateStatus] = useState<Status>("idle");
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // ---- 自分のリスト ----
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [listStatus, setListStatus] = useState<Status>("loading");
  const [listError, setListError] = useState<string | null>(null);
  // 追加・削除の処理中の店(ボタンを二度押しできないようにする)
  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const post = useCallback(
    async (path: string, body: object) => {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: buildAuthHeaders(idToken),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));
      return res.json();
    },
    [idToken],
  );

  const loadList = useCallback(async () => {
    try {
      const data = await post("/wishlist/list", {});
      setItems(data.items ?? []);
      setListStatus("success");
      setListError(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "リストの取得に失敗しました");
      setListStatus("error");
    }
  }, [post]);

  // 画面を開いたときに自分のリストを読み込む。状態の更新は読み込み完了後(.then)に行い、
  // 画面を離れた後に結果が返ってきた場合は反映しない
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    let cancelled = false;
    post("/wishlist/list", {})
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setListStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : "リストの取得に失敗しました");
        setListStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, post]);

  const handleSearch = async () => {
    setCandidateStatus("loading");
    setCandidateError(null);
    try {
      const data = await post("/wishlist/candidates", { meal_time: mealTime });
      setCandidates(data.candidates ?? []);
      setCandidateStatus("success");
    } catch (err) {
      setCandidateError(err instanceof Error ? err.message : "候補の取得に失敗しました");
      setCandidateStatus("error");
    }
  };

  const handleAdd = async (candidate: Candidate) => {
    setBusyPlaceId(candidate.place_id);
    setActionError(null);
    try {
      await post("/wishlist/add", { place_id: candidate.place_id, meal_time: mealTime });
      // 追加した店は候補から外し、リストを読み直す
      setCandidates((list) => list.filter((c) => c.place_id !== candidate.place_id));
      await loadList();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "リストへの追加に失敗しました");
    } finally {
      setBusyPlaceId(null);
    }
  };

  const handleDelete = async (item: WishlistItem) => {
    setBusyPlaceId(item.place_id);
    setActionError(null);
    try {
      await post("/wishlist/delete", { place_id: item.place_id });
      setItems((list) => list.filter((i) => i.place_id !== item.place_id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "リストからの削除に失敗しました");
    } finally {
      setBusyPlaceId(null);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <main className="wishlist">
        <h2>行ってみたい店</h2>
        <p>ログインすると、行ってみたい店リストを作れます。</p>
      </main>
    );
  }

  return (
    <main className="wishlist">
      <h2>行ってみたい店</h2>

      {/* ---- 候補を探す ---- */}
      <section className="wishlist__section">
        <h3>会社から徒歩10分以内の、まだ登録されていない店</h3>
        <div className="wishlist__search">
          <div className="wishlist__meal" role="radiogroup" aria-label="昼か晩か">
            {(["lunch", "dinner"] as MealTime[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={mealTime === key}
                className={`wishlist__meal-option${mealTime === key ? " is-selected" : ""}`}
                onClick={() => setMealTime(key)}
              >
                {MEAL_TIME_LABELS[key]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={candidateStatus === "loading"}
          >
            {candidateStatus === "loading"
              ? "探しています..."
              : candidateStatus === "idle"
                ? "候補を探す"
                : "別の候補を見る"}
          </button>
        </div>

        {candidateStatus === "error" && <p role="alert">{candidateError}</p>}
        {candidateStatus === "success" && candidates.length === 0 && (
          <p>条件に合う店が見つかりませんでした。もう一度探してみてください。</p>
        )}
        {candidates.length > 0 && (
          <ul className="wishlist__cards">
            {candidates.map((c) => (
              <li key={c.place_id} className="wishlist__card">
                <span className="wishlist__name">{c.title}</span>
                <span className="wishlist__meta">{c.category_name}</span>
                <span className="wishlist__meta">{c.address_label}</span>
                <span className="wishlist__walk">
                  会社から{formatWalk(c.walk_minutes, c.walk_distance_m)}
                </span>
                <button
                  type="button"
                  onClick={() => handleAdd(c)}
                  disabled={busyPlaceId !== null}
                >
                  {busyPlaceId === c.place_id ? "追加中..." : "リストに追加"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- 自分のリスト ---- */}
      <section className="wishlist__section">
        <h3>自分のリスト</h3>
        {actionError && <p role="alert">{actionError}</p>}
        {listStatus === "loading" && <p>読み込み中...</p>}
        {listStatus === "error" && <p role="alert">{listError}</p>}
        {listStatus === "success" && items.length === 0 && (
          <p>まだ行ってみたい店はありません。上の候補から追加してみましょう。</p>
        )}
        {items.length > 0 && (
          <ul className="wishlist__cards">
            {items.map((item) => (
              <li key={item.place_id} className="wishlist__card">
                <span className="wishlist__name">
                  {item.title}
                  <span className={`wishlist__label wishlist__label--${item.meal_time}`}>
                    {MEAL_TIME_LABELS[item.meal_time] ?? item.meal_time}
                  </span>
                </span>
                {item.category_name && <span className="wishlist__meta">{item.category_name}</span>}
                <span className="wishlist__meta">{item.address_label}</span>
                {item.registered ? (
                  <>
                    <span className="wishlist__registered">登録済みの店です</span>
                    <button type="button" onClick={() => onNavigate("store-detail", item.place_id)}>
                      店舗詳細を見る
                    </button>
                  </>
                ) : (
                  <>
                    {formatWalk(item.walk_minutes, item.walk_distance_m) && (
                      <span className="wishlist__walk">
                        会社から{formatWalk(item.walk_minutes, item.walk_distance_m)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onRegistStore({
                          place: {
                            PlaceId: item.place_id,
                            Title: item.title,
                            Address: { Label: item.address_label },
                            Position: [item.longitude, item.latitude],
                          },
                          mealTime: item.meal_time,
                        })
                      }
                    >
                      行ってきたので登録する
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="wishlist__remove"
                  onClick={() => handleDelete(item)}
                  disabled={busyPlaceId !== null}
                >
                  {busyPlaceId === item.place_id ? "削除中..." : "リストから外す"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
