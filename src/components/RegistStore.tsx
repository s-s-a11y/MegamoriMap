import { useState, useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { uploadImage } from "../utils/ImageUpload"; // 実際の配置場所に合わせてパスを調整してください
import { ImagePickerWithRotation } from "./ImagePickerWithRotation"; // 実際の配置場所に合わせてパスを調整してください
import "../css_components/RegistStore.css"; // ★追加(C65)
import { buildAuthHeaders } from "../utils/authHeaders"; // 実際の配置場所に合わせてパスを調整してください
import { API_BASE_URL, readErrorMessage } from "../utils/api";
import { looksLikeAddress, type MealTime } from "../utils/mealTime"; // ★追加(C71)

// 店舗検索API（SearchStore）が返す検索結果1件分
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
  // ★追加(機能追加#4)：行ってみたい店リストから来たときに、最初から選んでおく店と昼/晩
  preset?: {
    place: SearchResult;
    mealTime: "lunch" | "dinner";
  } | null;
  onNavigate: (
    view: "map" | "regist-store" | "regist-menu",
    placeId?: string,
    storeName?: string,
  ) => void;
}

// 池袋駅付近。現在地が取得できるまでの初期値、および取得に失敗した場合の保険として使う。
const FALLBACK_SEARCH_ORIGIN = { longitude: 139.7109, latitude: 35.7295 };

// 店舗登録用ページ
export function RegisterStorePage({
  onNavigate,
  preset = null,
}: RegisterStorePageProps) {
  // ★追加：書き込み系のAPI呼び出しに使うIDトークンを取得する
  const auth = useAuth();

  const [categories, setCategories] = useState<string[]>([]);
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
        console.warn(
          "現在地の取得に失敗しました。デフォルトの座標を使用します。",
          err,
        );
      },
    );
    fetch(
      `${API_BASE_URL}/categories/stores`,
    )
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  // ---- 検索まわりの状態 ----
  const [keyword, setKeyword] = useState("");
  const [searchStatus, setSearchStatus] = useState<Status>("idle");
  const [searchError, setSearchError] = useState<string | null>(null);
  // ★修正(機能追加#4)：行ってみたい店から来たときは、その店を検索結果として最初から表示・選択しておく
  const [results, setResults] = useState<SearchResult[]>(
    preset ? [preset.place] : [],
  );

  // ---- 選択・登録まわりの状態 ----
  const [selected, setSelected] = useState<SearchResult | null>(
    preset?.place ?? null,
  );
  const [registStatus, setRegistStatus] = useState<Status>("idle");
  const [registError, setRegistError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("");
  // ★追加：昼/晩(居酒屋対応)。★変更(C71)：「昼・晩どちらも」を追加
  const [mealTime, setMealTime] = useState<MealTime | "">(
    preset?.mealTime ?? "",
  );
  // ★追加：登録者自身が使った金額(任意)。★変更(C71)：夜の店だけ → すべての店
  const [pricePerPerson, setPricePerPerson] = useState("");
  // ★追加(C71)：登録する店名。検索結果の名前を初期値にし、直せるようにする
  // (検索で住所を選ぶと、住所がそのまま店名になってしまうため)
  const [storeName, setStoreName] = useState(preset?.place.Title ?? "");

  // ---- コメント・画像まわりの状態 ----
  const [comment, setComment] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  // ★追加：画像の回転角度(0/90/180/270)
  const [imageRotation, setImageRotation] = useState(0);

  // ---- カテゴリー作成モーダルまわりの状態 ----
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryRegistStatus, setCategoryRegistStatus] =
    useState<Status>("idle");
  const [categoryRegistError, setCategoryRegistError] = useState<string | null>(
    null,
  );
  const categoryDialogRef = useRef<HTMLDialogElement | null>(null);

  const handleSearch = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setSearchStatus("loading");
    setSearchError(null);
    setSelected(null);
    setRegistStatus("idle");

    try {
      const apiUrl =
        `${API_BASE_URL}/stores/search`;

      const origin =
        position.longitude !== null && position.latitude !== null
          ? { longitude: position.longitude, latitude: position.latitude }
          : FALLBACK_SEARCH_ORIGIN;

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
  const handleRegist = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;

    setRegistStatus("loading");
    setRegistError(null);

    try {
      const apiUrl =
        `${API_BASE_URL}/stores`;

      // 画像が選ばれていれば、共有ユーティリティでリサイズ・回転→S3へ直接アップロードする
      const image_url = imageFile
        ? await uploadImage(
            imageFile,
            "stores",
            imageRotation,
            auth.user?.id_token,
          )
        : undefined;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: buildAuthHeaders(auth.user?.id_token),
        body: JSON.stringify({
          PlaceId: selected.PlaceId,
          Title: storeName.trim(), // ★変更(C71)：画面で直した店名
          Position: selected.Position,
          Address: {
            Label: selected.Address.Label,
          },
          store_category_name: category,
          comment,
          meal_time: mealTime,
          // ★追加：入力されていれば送る(★変更(C71)：夜の店に限らない)
          price_per_person:
            pricePerPerson !== "" ? Number(pricePerPerson) : undefined,
          image_url,
        }),
      });

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error("この店舗はすでに登録されています。");
        }
        throw new Error(await readErrorMessage(res));
      }

      // ★変更：成功メッセージを出して留まるのではなく、Home画面へ即座に遷移する
      onNavigate("map");
    } catch (err) {
      setRegistError(err instanceof Error ? err.message : "登録に失敗しました");
      setRegistStatus("error");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
  };

  const openCategoryModal = () => {
    setNewCategoryName("");
    setCategoryRegistStatus("idle");
    setCategoryRegistError(null);
    setIsCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    setIsCategoryModalOpen(false);
  };

  useEffect(() => {
    const dialog = categoryDialogRef.current;
    if (!dialog) return;
    if (isCategoryModalOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isCategoryModalOpen && dialog.open) {
      dialog.close();
    }
  }, [isCategoryModalOpen]);

  const handleCreateCategory = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) return;

    setCategoryRegistStatus("loading");
    setCategoryRegistError(null);

    try {
      const apiUrl =
        `${API_BASE_URL}/categories/stores`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: buildAuthHeaders(auth.user?.id_token),
        body: JSON.stringify({ store_category_name: trimmedName }),
      });

      if (!res.ok && res.status !== 409) {
        throw new Error(await readErrorMessage(res));
      }

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
      {/* ★変更：h1・nav(戻る/メニュー登録へ)を削除。
          タイトルは共通ヘッダー側、Homeへの導線もそちらに移したため。 */}
      {/* ★変更(C65)：画面の見出しを付け、「1 検索して選ぶ → 2 カテゴリー → 3 登録内容」の手順ごとのカードに分ける */}
      <main className="regist-store">
        <header>
          <h2>店舗を登録する</h2>
          <p>お店を検索して選び、カテゴリーと昼/晩を決めて登録します</p>
        </header>

        <section className="regist-store__step">
          <h3 className="regist-store__step-title">
            <span className="regist-store__step-no">1</span>
            お店を検索して選ぶ
          </h3>

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

          {/* --- 検索結果一覧（ラジオボタンで1件選ぶ） --- */}
          {results.length > 0 && (
            <ul className="regist-store__results">
              {results.map((item) => (
                <li key={item.PlaceId}>
                  <label>
                    <input
                      type="radio"
                      name="selected-store"
                      checked={selected?.PlaceId === item.PlaceId}
                      onChange={() => {
                        setSelected(item);
                        setStoreName(item.Title); // ★追加(C71)
                      }}
                    />{" "}
                    <strong>{item.Title}</strong>
                    <br />
                    <small>{item.Address.Label}</small>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {/* ★追加(C65)：行ってみたい店から来たとき等、検索せずに選ばれている店 */}
          {selected && results.length === 0 && (
            <p className="regist-store__selected">
              選択中：<strong>{selected.Title}</strong>
            </p>
          )}
        </section>

        {/* --- カテゴリー選択＋新規作成ボタン --- */}
        <section className="regist-store__step">
          <h3 className="regist-store__step-title">
            <span className="regist-store__step-no">2</span>
            カテゴリーを選ぶ
          </h3>
          <div className="regist-store__category">
            <select value={category} onChange={handleChange} aria-label="カテゴリー">
              <option value="">選択してください</option>
              {categories.map((ctgly) => (
                <option key={ctgly} value={ctgly}>
                  {ctgly}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={openCategoryModal}
              disabled={!auth.isAuthenticated}
            >
              カテゴリを作成する
            </button>
          </div>

          {!auth.isAuthenticated && (
            <p role="alert">
              カテゴリの作成には、右上の「ログイン」から先にログインしてください。
            </p>
          )}
        </section>

        {/* --- 選択中の店舗の確認・コメント・画像・登録ボタン --- */}
        {selected && (
          <section className="regist-store__step">
            <h3 className="regist-store__step-title">
              <span className="regist-store__step-no">3</span>
              登録内容を確認する
            </h3>
            <form onSubmit={handleRegist}>
              {/* ★変更(C71)：店名を確認・修正できる入力欄にする */}
              <label>
                店名
                <input
                  type="text"
                  value={storeName}
                  maxLength={50}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                />
              </label>
              {looksLikeAddress(storeName) && (
                <p role="status" className="regist-store__name-warning">
                  店名が住所になっています。お店の名前に直してから登録してください。
                </p>
              )}

              {/* ★追加：昼/晩(居酒屋対応)。必須項目 */}
              <fieldset>
                <legend>昼の店？晩の店？</legend>
                <label>
                  <input
                    type="radio"
                    name="meal-time"
                    value="lunch"
                    checked={mealTime === "lunch"}
                    onChange={() => setMealTime("lunch")}
                    required
                  />{" "}
                  昼
                </label>
                <label>
                  <input
                    type="radio"
                    name="meal-time"
                    value="dinner"
                    checked={mealTime === "dinner"}
                    onChange={() => setMealTime("dinner")}
                  />{" "}
                  晩
                </label>
                {/* ★追加(C71)：昼・晩どちらも */}
                <label>
                  <input
                    type="radio"
                    name="meal-time"
                    value="both"
                    checked={mealTime === "both"}
                    onChange={() => setMealTime("both")}
                  />{" "}
                  昼・晩どちらも
                </label>
              </fieldset>

              {/* ★追加：使った金額の入力欄(任意)。★変更(C71)：夜の店だけ → すべての店で表示 */}
              <label>
                実際に使った金額（1人あたり、任意）
                <input
                  type="number"
                  value={pricePerPerson}
                  min={0}
                  onChange={(e) => setPricePerPerson(e.target.value)}
                  placeholder="例: 1200"
                />
                <small>予算帯の表示に使います。昼の店は、メニューが登録されるとメニューの平均価格が優先されます</small>
              </label>

              <label>
                コメント（任意）
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="この店舗の特徴やおすすめポイントなど"
                />
              </label>

              {/* ★変更：プレビュー＋回転ボタン付きの共有コンポーネントに置き換え */}
              <ImagePickerWithRotation
                label="写真（任意）"
                file={imageFile}
                rotation={imageRotation}
                onFileChange={setImageFile}
                onRotationChange={setImageRotation}
              />

              {!auth.isAuthenticated && (
                <p role="alert">
                  店舗を登録するには、右上の「ログイン」から先にログインしてください。
                </p>
              )}

              <button
                type="submit"
                disabled={
                  registStatus === "loading" || !auth.isAuthenticated || !mealTime ||
                  !storeName.trim()
                }
              >
                {registStatus === "loading" ? "登録中..." : "この店舗を登録する"}
              </button>
            </form>
          </section>
        )}

        {registStatus === "error" && <p role="alert">{registError}</p>}
      </main>

      {/* --- カテゴリー作成モーダル --- */}
      <dialog
        ref={categoryDialogRef}
        onClose={closeCategoryModal}
        onClick={(e) => {
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
                categoryRegistStatus === "loading" ||
                !newCategoryName.trim() ||
                !auth.isAuthenticated
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
