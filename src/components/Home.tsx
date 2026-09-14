import { useEffect, useMemo, useState } from "react";
import { formatBudgetBand } from "../utils/FormatPrice"; // 実際の配置場所に合わせてパスを調整してください
import "./Home.css";

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
  image_url: string; // ★カード表示用に追加。ShowMegaMap.py側の対応が必要(本文参照)
};

const ALL_CATEGORIES = "";
const PAGE_SIZE = 8; // 縦2 × 横4 = 1ページ8件

// ShowMegaMap は longitude/latitude が必須入力だが、実装上は絞り込みに
// 使われていないため、固定値を送っておく。
const DEFAULT_ORIGIN = { longitude: 139.7109, latitude: 35.7295 };

// App.tsx から画面切り替え関数を受け取るためのprops
interface HomePageProps {
  onNavigate: (
    view: "map" | "regist-store" | "regist-menu" | "store-detail",
    placeId?: string,
  ) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  //   店舗情報格納用State
  const [stores, setStores] = useState<Store[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  // ★追加：ページング用State(何ページ目を表示中か。1始まり)
  const [currentPage, setCurrentPage] = useState(1);

  //   画面表示時に一度だけ店舗情報を取得する
  useEffect(() => {
    fetch(
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowMegaMap",
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

  // categoryFilterに応じて表示対象の店舗を絞り込む
  const filteredStores = useMemo(() => {
    if (categoryFilter === ALL_CATEGORIES) return stores;
    return stores.filter(
      (store) => store.store_category_name === categoryFilter,
    );
  }, [stores, categoryFilter]);

  // ★追加：絞り込み条件が変わったら1ページ目に戻す
  // (直前のページ番号のままだと、絞り込んだ結果ページが存在しなくなることがあるため)
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));

  // ★追加：現在のページ番号分だけ切り出す
  const pagedStores = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStores.slice(start, start + PAGE_SIZE);
  }, [filteredStores, currentPage]);

  const handleCategoryFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setCategoryFilter(e.target.value);
  };

  const goToPrevPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  };

  return (
    <div>
      <nav>
        <button onClick={() => onNavigate("regist-store")}>
          店舗を登録する
        </button>
        <button onClick={() => onNavigate("regist-menu")}>
          メニューを登録する
        </button>
      </nav>

      {/* ★変更：home-mainクラスを付けて、この画面だけ幅の制限を広げる */}
      <main className="home-main">
        <h1>メガ盛りマップ</h1>

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

        {/* ★変更：テーブルの代わりにカードグリッドで表示 */}
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

        {/* ★追加：ページング */}
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
