import { useState, useEffect } from "react";

// 店舗検索API（SearchStore）が返す検索結果1件分
// = Amazon Location Serviceの検索結果をそのまま返している
interface SearchResult {
  PlaceId: string;
  Title: string;
  Address: {
    Label: string;
  };
  Position: [number, number]; // [経度, 緯度]
}

interface Position {
  latitude: number | null;
  longitude: number | null;
}

// 読み込み情報表示用type
type Status = "idle" | "loading" | "success" | "error";

// App.tsx から画面切り替え関数を受け取るためのprops
interface RegisterStorePageProps {
  onNavigate: (view: "map" | "regist-store" | "regist-menu") => void;
}

// 池袋駅付近。現在地が取得できるまでの初期値、および取得に失敗した場合の保険として使う。
const FALLBACK_SEARCH_ORIGIN = { longitude: 139.7109, latitude: 35.7295 };

// ------------------------------------------------------------
// エラーメッセージの読み取り
// RegistStore.py は 400/409 のときはJSON({"message": "..."})、
// 500のときはプレーン文字列を返すので、両方に対応できるようにする
// ------------------------------------------------------------
async function readErrorMessage(res: Response): Promise<string> {
  const rawText = await res.text();
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed === "object" && parsed?.message) {
      return parsed.message;
    }
    return rawText;
  } catch {
    return rawText || `エラーが発生しました（ステータスコード: ${res.status}）`;
  }
}

// 店舗登録用ページ
export function RegisterStorePage({ onNavigate }: RegisterStorePageProps) {
  // カテゴリー格納用配列State
  const [categories, setCategories] = useState<string[]>([]);
  // 現在地格納用State
  const [position, setPosition] = useState<Position>({
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        // 取得失敗（許可されなかった等）の場合はログだけ残し、FALLBACK_SEARCH_ORIGINを使い続ける
        console.warn(
          "現在地の取得に失敗しました。デフォルトの座標を使用します。",
          err,
        );
      },
    );
    fetch(
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowStoreCategory",
    )
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);
  // ---- 検索まわりの状態 ----
  const [keyword, setKeyword] = useState("");
  const [searchStatus, setSearchStatus] = useState<Status>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);

  // ---- 選択・登録まわりの状態 ----
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [registStatus, setRegistStatus] = useState<Status>("idle");
  const [registError, setRegistError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");

  // ---- カテゴリー作成モーダルまわりの状態 ----
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryRegistStatus, setCategoryRegistStatus] =
    useState<Status>("idle");
  const [categoryRegistError, setCategoryRegistError] = useState<string | null>(
    null,
  );

  // 「検索」ボタンが押されたときの処理
  const handleSearch = async (e: React.FormEvent) => {
    // ページリロードの防止
    e.preventDefault();
    if (!keyword.trim()) return;

    setSearchStatus("loading");
    setSearchError(null);
    setSelected(null);
    setRegistStatus("idle");

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/SearchStore";

      // 現在地が取れていればそれを使い、まだなければフォールバック座標を使う
      const origin =
        position.longitude !== null && position.latitude !== null
          ? { longitude: position.longitude, latitude: position.latitude }
          : FALLBACK_SEARCH_ORIGIN;

      // Lambda関数　SearchStoreに接続
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          longitude: origin.longitude,
          latitude: origin.latitude,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      const data = await res.json();
      setResults(data.ResultItems ?? []);
      setSearchStatus("success");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "検索に失敗しました");
      setSearchStatus("error");
    }
  };

  // 「この店舗を登録する」ボタンが押されたときの処理
  const handleRegist = async () => {
    if (!selected) return;

    setRegistStatus("loading");
    setRegistError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/RegistStore";

      // RegistStore.py の check_input() が読む形に合わせる：
      // PlaceId / Title / Position はそのまま、
      // 住所は Address.Label というネスト構造で送る
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          PlaceId: selected.PlaceId,
          Title: selected.Title,
          Position: selected.Position,
          Address: {
            Label: selected.Address.Label,
          },
          store_category_name: category,
        }),
      });

      if (!res.ok) {
        // 409: 既に登録済みの店舗の場合、専用のメッセージにする
        if (res.status === 409) {
          throw new Error("この店舗はすでに登録されています。");
        }
        throw new Error(await readErrorMessage(res));
      }

      setRegistStatus("success");
    } catch (err) {
      setRegistError(err instanceof Error ? err.message : "登録に失敗しました");
      setRegistStatus("error");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
  };

  // モーダルを開く。前回の入力内容・エラー・成功状態を初期化してから開く。
  const openCategoryModal = () => {
    setNewCategoryName("");
    setCategoryRegistStatus("idle");
    setCategoryRegistError(null);
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
  };

  // 「登録」ボタンが押されたときの処理（カテゴリー作成API: RegistStoreCategory）
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    setCategoryRegistStatus("loading");
    setCategoryRegistError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/RegistStoreCategory";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_category_name: trimmedName }),
      });

      // 409は「そのカテゴリー名は既に存在する」という意味なので、
      // エラー扱いにせず、そのまま既存のカテゴリーとして使う。
      if (!res.ok && res.status !== 409) {
        throw new Error(await readErrorMessage(res));
      }

      // 一覧にまだ無ければ追加し、作成したカテゴリーを選択状態にする
      setCategories((prev) =>
        prev.includes(trimmedName) ? prev : [...prev, trimmedName],
      );
      setCategory(trimmedName);

      setCategoryRegistStatus("success");
      closeCategoryModal();
    } catch (err) {
      setCategoryRegistError(
        err instanceof Error ? err.message : "カテゴリーの作成に失敗しました",
      );
      setCategoryRegistStatus("error");
    }
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "24px 16px",
        fontFamily: "sans-serif",
      }}
    >
      {/* 他の画面への移動ボタン */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => onNavigate("map")}>← 地図に戻る</button>
        <button onClick={() => onNavigate("regist-menu")}>
          メニュー登録へ
        </button>
      </div>

      <h1>店舗登録</h1>

      {/* --- 検索フォーム --- */}
      <form
        onSubmit={handleSearch}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="店名やキーワードで検索（例: つけ麺 池袋）"
          style={{ flex: 1, padding: "8px 12px" }}
        />
        <button type="submit" disabled={searchStatus === "loading"}>
          {searchStatus === "loading" ? "検索中..." : "検索"}
        </button>
      </form>

      {searchStatus === "error" && (
        <p style={{ color: "red" }}>{searchError}</p>
      )}

      {searchStatus === "success" && results.length === 0 && (
        <p>該当する店舗が見つかりませんでした。</p>
      )}

      {/* --- カテゴリー選択＋新規作成ボタン --- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <label>カテゴリー：</label>
        <select value={category} onChange={handleChange}>
          <option value="">選択してください</option>
          {categories.map((ctgly) => (
            <option key={ctgly} value={ctgly}>
              {ctgly}
            </option>
          ))}
        </select>
        <button type="button" onClick={openCategoryModal}>
          カテゴリを作成する
        </button>
      </div>

      {/* --- 検索結果一覧（ラジオボタンで1件選ぶ） --- */}
      {results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginBottom: 16 }}>
          {results.map((item) => (
            <li
              key={item.PlaceId}
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <span>
                  <input
                    type="radio"
                    name="selected-store"
                    checked={selected?.PlaceId === item.PlaceId}
                    onChange={() => setSelected(item)}
                  />{" "}
                  <strong>{item.Title}</strong>
                </span>
                <span style={{ fontSize: 12, color: "#666" }}>
                  {item.Address.Label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {/* --- 選択中の店舗の確認・登録ボタン --- */}
      {selected && (
        <div style={{ marginBottom: 16 }}>
          <p>
            「<strong>{selected.Title}</strong>」を登録します。よろしいですか？
          </p>
          <button onClick={handleRegist} disabled={registStatus === "loading"}>
            {registStatus === "loading" ? "登録中..." : "この店舗を登録する"}
          </button>
        </div>
      )}

      {registStatus === "success" && (
        <p style={{ color: "green" }}>店舗を登録しました。</p>
      )}
      {registStatus === "error" && (
        <p style={{ color: "red" }}>{registError}</p>
      )}

      {/* --- カテゴリー作成モーダル --- */}
      {isCategoryModalOpen && (
        <div
          // オーバーレイ：クリックしたら閉じる
          onClick={closeCategoryModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            // モーダル本体：クリックしてもオーバーレイまで伝播させず閉じないようにする
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 24,
              width: "90%",
              maxWidth: 360,
            }}
          >
            <h2 style={{ marginTop: 0 }}>新しいカテゴリーを作成</h2>

            <form onSubmit={handleCreateCategory}>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="カテゴリー名（例: つけ麺）"
                autoFocus
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />

              {categoryRegistStatus === "error" && (
                <p style={{ color: "red", marginTop: 0 }}>
                  {categoryRegistError}
                </p>
              )}

              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <button type="button" onClick={closeCategoryModal}>
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={
                    categoryRegistStatus === "loading" ||
                    !newCategoryName.trim()
                  }
                >
                  {categoryRegistStatus === "loading" ? "登録中..." : "登録"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
