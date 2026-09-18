import { useEffect, useMemo, useState } from "react";
import { useAuth } from "react-oidc-context";
import { formatBudgetBand } from "../utils/FormatPrice"; // 実際の配置場所に合わせてパスを調整してください
import "../css_components/Home.css";

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
};

const ALL_CATEGORIES = "";
const ALL_MEAL_TIMES = "";
const PAGE_SIZE = 8; // 縦2 × 横4 = 1ページ8件

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
}

export function HomePage({ onNavigate }: HomePageProps) {
  const auth = useAuth();
  //   店舗情報格納用State
  const [stores, setStores] = useState<Store[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  // ★追加：昼/晩の絞り込み用State。カテゴリーとは別軸の絞り込み
  const [mealTimeFilter, setMealTimeFilter] = useState<string>(ALL_MEAL_TIMES);
  const [currentPage, setCurrentPage] = useState(1);

  //   画面表示時に一度だけ店舗情報を取得する
  useEffect(() => {
    fetch(
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/map",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(DEFAULT_ORIGIN),
      },
    )
      .then((res) => res.json())
      .then((data) => setStores(data.stores ?? []));
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
      return matchesCategory && matchesMealTime;
    });
  }, [stores, categoryFilter, mealTimeFilter]);

  // 絞り込み条件が変わったら1ページ目に戻す
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, mealTimeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));

  const pagedStores = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStores.slice(start, start + PAGE_SIZE);
  }, [filteredStores, currentPage]);

  const handleCategoryFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setCategoryFilter(e.target.value);
  };

  // ★追加
  const handleMealTimeFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setMealTimeFilter(e.target.value);
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
      <nav>
        <button
          disabled={!auth.isAuthenticated}
          onClick={() => onNavigate("regist-store")}
        >
          店舗を登録する
        </button>
      </nav>

      <main className="home-main">
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

        <ul className="store-grid">
          {pagedStores.map((store) => (
            <li key={store.place_id} className="store-card">
              {store.image_url ? (
                <img
                  className="store-card__image"
                  src={store.image_url}
                  alt={store.title}
                />
              ) : (
                <div className="store-card__placeholder">写真なし</div>
              )}

              <div className="store-card__body">
                <span className="store-card__name">{store.title}</span>
                <span className="store-card__category">
                  {store.store_category_name}
                  {/* ★追加：カテゴリーの隣に昼/晩も分かるように表示 */}・
                  {MEAL_TIME_LABELS[store.meal_time] ?? store.meal_time}
                </span>
                <span className="store-card__price">
                  {formatBudgetBand(store.avg_price)}
                </span>
                <button
                  className="store-card__button"
                  onClick={() => onNavigate("store-detail", store.place_id)}
                >
                  詳細を見る
                </button>
              </div>
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
