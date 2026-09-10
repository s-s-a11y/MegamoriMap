import { useState, useEffect, useRef } from "react";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください

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

  // ---- コメント・画像まわりの状態 ----
  const [comment, setComment] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  // ---- カテゴリー作成モーダルまわりの状態 ----
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryRegistStatus, setCategoryRegistStatus] =
    useState<Status>("idle");
  const [categoryRegistError, setCategoryRegistError] = useState<string | null>(
    null,
  );
  // ネイティブ<dialog>要素の開閉をJSから制御するための参照
  const categoryDialogRef = useRef<HTMLDialogElement | null>(null);

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

  // 「この店舗を登録する」ボタン(フォームの送信)が押されたときの処理
  const handleRegist = async (e: React.ChangeEvent) => {
    e.preventDefault();
    if (!selected) return;

    setRegistStatus("loading");
    setRegistError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/RegistStore";

      // 画像が選ばれていれば、共有ユーティリティでリサイズ→S3へ直接アップロードする
      const image_url = imageFile
        ? await uploadImage(imageFile, "stores")
        : undefined;

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
          comment,
          image_url,
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
      setComment("");
      setImageFile(null);
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

  // isCategoryModalOpenの変化に合わせて<dialog>のshowModal()/close()を呼ぶ。
  // <dialog>はopen属性だけを付けても背景の暗転(::backdrop)やEscでの
  // クローズが効かないため、正しいモーダル動作にはJSからの呼び出しが必要。
  useEffect(() => {
    const dialog = categoryDialogRef.current;
    if (!dialog) return;
    if (isCategoryModalOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isCategoryModalOpen && dialog.open) {
      dialog.close();
    }
  }, [isCategoryModalOpen]);

  // 「登録」ボタンが押されたときの処理（カテゴリー作成API: RegistStoreCategory）
  const handleCreateCategory = async (e: React.ChangeEvent) => {
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
    <div>
      {/* 他の画面への移動ボタン */}
      <nav>
        <button onClick={() => onNavigate("map")}>← 地図に戻る</button>
        <button onClick={() => onNavigate("regist-menu")}>
          メニュー登録へ
        </button>
      </nav>

      <main>
        <h1>店舗登録</h1>

        {/* --- 検索フォーム --- */}
        <search>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="店名やキーワードで検索（例: つけ麺 池袋）"
            />
            <button type="submit" disabled={searchStatus === "loading"}>
              {searchStatus === "loading" ? "検索中..." : "検索"}
            </button>
          </form>
        </search>

        {searchStatus === "error" && <p role="alert">{searchError}</p>}

        {searchStatus === "success" && results.length === 0 && (
          <p>該当する店舗が見つかりませんでした。</p>
        )}

        {/* --- カテゴリー選択＋新規作成ボタン --- */}
        <fieldset>
          <legend>カテゴリー</legend>
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
        </fieldset>

        {/* --- 検索結果一覧（ラジオボタンで1件選ぶ） --- */}
        {results.length > 0 && (
          <ul>
            {results.map((item) => (
              <li key={item.PlaceId}>
                <label>
                  <input
                    type="radio"
                    name="selected-store"
                    checked={selected?.PlaceId === item.PlaceId}
                    onChange={() => setSelected(item)}
                  />{" "}
                  <strong>{item.Title}</strong>
                  <br />
                  <small>{item.Address.Label}</small>
                </label>
              </li>
            ))}
          </ul>
        )}

        {/* --- 選択中の店舗の確認・コメント・画像・登録ボタン --- */}
        {selected && (
          <form onSubmit={handleRegist}>
            <p>
              「<strong>{selected.Title}</strong>
              」を登録します。よろしいですか？
            </p>

            <label>
              コメント（任意）
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="この店舗の特徴やおすすめポイントなど"
              />
            </label>

            <label>
              写真（任意）
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <button type="submit" disabled={registStatus === "loading"}>
              {registStatus === "loading" ? "登録中..." : "この店舗を登録する"}
            </button>
          </form>
        )}

        {registStatus === "success" && (
          <p role="status">店舗を登録しました。</p>
        )}
        {registStatus === "error" && <p role="alert">{registError}</p>}
      </main>

      {/* --- カテゴリー作成モーダル --- */}
      <dialog
        ref={categoryDialogRef}
        onClose={closeCategoryModal}
        onClick={(e) => {
          // ダイアログの外周(背景)をクリックした時だけ閉じる。
          // 内側の要素をクリックした場合は e.target がその子要素になるため、
          // e.currentTarget(dialog自身)と一致する時だけ閉じる判定にしている。
          if (e.target === e.currentTarget) closeCategoryModal();
        }}
      >
        <h2>新しいカテゴリーを作成</h2>

        <form onSubmit={handleCreateCategory}>
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="カテゴリー名（例: つけ麺）"
            autoFocus
          />

          {categoryRegistStatus === "error" && (
            <p role="alert">{categoryRegistError}</p>
          )}

          <div>
            <button type="button" onClick={closeCategoryModal}>
              キャンセル
            </button>
            <button
              type="submit"
              disabled={
                categoryRegistStatus === "loading" || !newCategoryName.trim()
              }
            >
              {categoryRegistStatus === "loading" ? "登録中..." : "登録"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
