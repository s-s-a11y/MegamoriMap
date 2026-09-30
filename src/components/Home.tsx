import { useEffect, useMemo, useState } from "react";
import { formatBudgetBand, getBudgetSourcePrice } from "../utils/FormatPrice"; // 実際の配置場所に合わせてパスを調整してください
import "../css_components/Home.css";
import { UserNameForm } from "./UserNameForm";
import { API_BASE_URL, readErrorMessage } from "../utils/api";

// 店舗情報格納用typeの定義
type Store = {
  place_id: string;
  title: string;
  avg_price: number;
  address_label: string;
  store_url: string;
  longitude: number;
  latitude: number;
  store_category_name: string;
  image_url: string;
  // ★追加：昼/晩の絞り込み用(居酒屋対応)
  meal_time: "lunch" | "dinner";
  // ★追加：夜(dinner)の店の予算帯表示に使う、申告額の平均
  price_per_person: number;
  // ★追加(C38)：登録日(YYYYMMDD)。新着(NEW)の印に使う(古いAPIの応答には無い)
  created_at?: string;
};

type LoadStatus = "loading" | "success" | "error";

const ALL_CATEGORIES = "";
const ALL_MEAL_TIMES = "";
const PAGE_SIZE = 8; // 縦2 × 横4 = 1ページ8件
// ★追加(C38)：登録から何日以内を新着(NEW)とするか
const NEW_STORE_DAYS = 7;

// 登録日(YYYYMMDD)が、nowから NEW_STORE_DAYS 日以内かどうか
function isNewStore(createdAt: string | undefined, now: number): boolean {
  if (!createdAt || !/^\d{8}$/.test(createdAt)) return false;
  const created = new Date(
    Number(createdAt.slice(0, 4)),
    Number(createdAt.slice(4, 6)) - 1,
    Number(createdAt.slice(6, 8)),
  ).getTime();
  return now - created < NEW_STORE_DAYS * 24 * 60 * 60 * 1000;
}

// meal_timeの値を、画面表示用の日本語に変換する
const MEAL_TIME_LABELS: Record<string, string> = {
  lunch: "昼",
  dinner: "晩",
};

// ShowMegaMap は longitude/latitude が必須入力だが、実装上は絞り込みに
// 使われていないため、固定値を送っておく。
const DEFAULT_ORIGIN = { longitude: 139.7109, latitude: 35.7295 };

// App.tsx から画面切り替え関数を受け取るためのprops
interface HomePageProps {
  onNavigate: (
    view: "map" | "regist-store" | "regist-menu" | "store-detail",
    placeId?: string,
    storeName?: string,
  ) => void;
  // ★追加(機能追加#1)：ログイン中の利用者のユーザー名(null=未ログイン・取得中、""=未設定)
  userName?: string | null;
  onSaveUserName?: (name: string) => Promise<void>;
}

export function HomePage({
  onNavigate,
  userName = null,
  onSaveUserName,
}: HomePageProps) {
  //   店舗情報格納用State
  const [stores, setStores] = useState<Store[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  // ★追加：昼/晩の絞り込み用State。カテゴリーとは別軸の絞り込み
  const [mealTimeFilter, setMealTimeFilter] = useState<string>(ALL_MEAL_TIMES);
  const [currentPage, setCurrentPage] = useState(1);
  // ★追加(C39)：店名のキーワード検索
  const [keyword, setKeyword] = useState("");
  // ★追加(C40)：「今日どこ行く？」で選ばれた店舗
  const [pickedStore, setPickedStore] = useState<Store | null>(null);
  // 新着判定の基準時刻(画面を開いた時点。描画のたびに変わらないよう固定する)
  const [now] = useState(() => Date.now());

  // ★追加：店舗一覧の読み込み状態。失敗時に「0件」と区別できるようにする
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);

  //   画面表示時に一度だけ店舗情報を取得する
  // ★修正：レスポンスの成否を確認し、失敗時はエラーを表示する
  // (以前はres.okを確認していなかったため、APIが失敗しても「店舗0件」に見えていた)
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/map`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(DEFAULT_ORIGIN),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await readErrorMessage(res));
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setStores(data.stores ?? []);
        setLoadStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadErrorMessage(
          err instanceof Error ? err.message : "店舗情報の取得に失敗しました",
        );
        setLoadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // storesの中に実際に登場するカテゴリー名だけを重複無しで抽出する
  const categoryOptions = useMemo(() => {
    const names = stores
      .map((store) => store.store_category_name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names));
  }, [stores]);

  // categoryFilter・mealTimeFilterに応じて表示対象の店舗を絞り込む
  // (2つは別軸の絞り込みなので、両方同時に適用するAND条件にする)
  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      const matchesCategory =
        categoryFilter === ALL_CATEGORIES ||
        store.store_category_name === categoryFilter;
      const matchesMealTime =
        mealTimeFilter === ALL_MEAL_TIMES || store.meal_time === mealTimeFilter;
      // ★追加(C39)：店名にキーワードが含まれるか(前後の空白は無視、英字の大小は区別しない)
      const matchesKeyword = store.title
        .toLowerCase()
        .includes(keyword.trim().toLowerCase());
      return matchesCategory && matchesMealTime && matchesKeyword;
    });
  }, [stores, categoryFilter, mealTimeFilter, keyword]);


  const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));

  const pagedStores = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStores.slice(start, start + PAGE_SIZE);
  }, [filteredStores, currentPage]);

  const handleCategoryFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setCategoryFilter(e.target.value);
    // ★修正：絞り込み条件が変わったら1ページ目に戻す(以前はeffectで行っていた)
    setCurrentPage(1);
  };

  // ★追加
  const handleMealTimeFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setMealTimeFilter(e.target.value);
    // ★修正：絞り込み条件が変わったら1ページ目に戻す(以前はeffectで行っていた)
    setCurrentPage(1);
  };

  // ★追加(C39)
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
    setCurrentPage(1);
  };

  // ★追加(C40)：絞り込み・検索の条件に合う店舗から1店をランダムに選ぶ。
  // 2店以上あるときは、直前に選ばれた店が続けて出ないようにする
  const handlePickRandomStore = () => {
    const candidates =
      filteredStores.length > 1 && pickedStore
        ? filteredStores.filter((s) => s.place_id !== pickedStore.place_id)
        : filteredStores;
    if (candidates.length === 0) return;
    setPickedStore(candidates[Math.floor(Math.random() * candidates.length)]);
  };

  const goToPrevPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  };

  return (
    <div>
      {/* ★変更：「メニューを登録する」ボタンを削除。
          メニュー登録は店舗詳細画面から行う形式に変更したため。
          タイトル(h1)も共通ヘッダー側に移したため、ここでは持たない。 */}
      {/* ★追加(機能追加#1)：ユーザー名が未設定のログイン中の利用者に、登録を案内する */}
      {userName === "" && onSaveUserName && (
        <section className="user-name-banner" role="status">
          <p>
            ユーザー名が登録されていません。登録すると、店舗やコメントの投稿者として表示されます。
          </p>
          <UserNameForm submitLabel="ユーザー名を登録" onSave={onSaveUserName} />
        </section>
      )}

      <nav>
        <button onClick={() => onNavigate("regist-store")}>
          店舗を登録する
        </button>
      </nav>

      <main className="home-main">
        {/* ★修正(C33)：2つの絞り込みを横に並べ、1つあたりの幅を抑える(狭い画面では縦に並ぶ) */}
        <div className="home-filters">
          {/* ★追加(C39)：店名のキーワード検索 */}
          <label>
            店名で検索
            <input
              type="search"
              value={keyword}
              onChange={handleKeywordChange}
              placeholder="例：ラーメン"
            />
          </label>

          {/* カテゴリー絞り込み */}
          <label>
            カテゴリーで絞り込み
            <select value={categoryFilter} onChange={handleCategoryFilterChange}>
              <option value={ALL_CATEGORIES}>すべて</option>
              {categoryOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {/* ★追加：昼/晩の絞り込み(カテゴリーとは別軸) */}
          <label>
            昼/晩で絞り込み
            <select value={mealTimeFilter} onChange={handleMealTimeFilterChange}>
              <option value={ALL_MEAL_TIMES}>すべて</option>
              <option value="lunch">昼</option>
              <option value="dinner">晩</option>
            </select>
          </label>
        </div>

        {/* ★追加(C40)：「今日どこ行く？」。今の絞り込み・検索の条件から1店を提案する */}
        {loadStatus === "success" && stores.length > 0 && (
          <div className="home-random">
            <button
              type="button"
              className="home-random__button"
              onClick={handlePickRandomStore}
              disabled={filteredStores.length === 0}
            >
              {pickedStore ? "もう一回選ぶ" : "今日どこ行く？"}
            </button>
            {pickedStore && (
              <div className="home-random__result" role="status">
                <span className="home-random__lead">今日はここ！</span>
                <span className="home-random__name">{pickedStore.title}</span>
                <span className="home-random__meta">
                  {pickedStore.store_category_name}・
                  {MEAL_TIME_LABELS[pickedStore.meal_time] ?? pickedStore.meal_time}・
                  {formatBudgetBand(getBudgetSourcePrice(pickedStore))}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate("store-detail", pickedStore.place_id)}
                >
                  この店を見る
                </button>
              </div>
            )}
          </div>
        )}

        {/* ★追加：読み込み中・エラー・0件の表示 */}
        {loadStatus === "loading" && <p>読み込み中...</p>}

        {loadStatus === "error" && (
          <p role="alert">
            店舗情報の取得に失敗しました。時間をおいて再度お試しください。
            （{loadErrorMessage}）
          </p>
        )}

        {loadStatus === "success" && stores.length === 0 && (
          <p>まだ店舗が登録されていません。</p>
        )}

        {loadStatus === "success" &&
          stores.length > 0 &&
          filteredStores.length === 0 && <p>条件に合う店舗がありません。</p>}

        <ul className="store-grid">
          {pagedStores.map((store) => (
            <li key={store.place_id} className="store-card">
              {/* ★修正(C34)：「詳細を見る」ボタンをやめ、カード全体を押すと詳細画面へ移動する。
                  ボタンの中に置けるのは文章レベルの要素だけのため、divではなくspanを使う */}
              <button
                type="button"
                className="store-card__link"
                onClick={() => onNavigate("store-detail", store.place_id)}
              >
                {/* ★追加(C38)：登録から7日以内の店に「NEW」の印を付ける */}
                <span className="store-card__media">
                  {store.image_url ? (
                    <img
                      className="store-card__image"
                      src={store.image_url}
                      alt={store.title}
                    />
                  ) : (
                    <span className="store-card__placeholder">写真なし</span>
                  )}
                  {isNewStore(store.created_at, now) && (
                    <span className="store-card__new">NEW</span>
                  )}
                </span>

                <span className="store-card__body">
                  <span className="store-card__name">{store.title}</span>
                  <span className="store-card__category">
                    {store.store_category_name}
                    {/* ★修正(C38)：昼/晩を色分けしたラベルにする */}
                    <span
                      className={`store-card__meal store-card__meal--${store.meal_time}`}
                    >
                      {MEAL_TIME_LABELS[store.meal_time] ?? store.meal_time}
                    </span>
                  </span>
                  <span className="store-card__price">
                    {formatBudgetBand(getBudgetSourcePrice(store))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="pagination">
          <button onClick={goToPrevPage} disabled={currentPage <= 1}>
            ← 前へ
          </button>
          <span className="pagination__status">
            {currentPage} / {totalPages}
          </span>
          <button onClick={goToNextPage} disabled={currentPage >= totalPages}>
            次へ →
          </button>
        </div>
      </main>
    </div>
  );
}
