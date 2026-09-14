import { useEffect, useState, useMemo } from "react";
import { formatBudgetBand } from "../utils/FormatPrice"; // 実際の配置場所に合わせてパスを調整してください

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
};

const ALL_CATEGORIES = "";

// ShowMegaMap は longitude/latitude が必須入力だが、実装上は絞り込みに
// 使われていない(地図表示自体をこのページから無くしたため、現在地取得は
// もう不要になった)。固定値を送っておく。
const DEFAULT_ORIGIN = { longitude: 139.7109, latitude: 35.7295 };

// App.tsx から画面切り替え関数を受け取るためのprops
interface MapComponentProps {
  onNavigate: (
    view: "map" | "regist-store" | "regist-menu" | "store-detail",
    placeId?: string,
  ) => void;
}

export function MapComponent({ onNavigate }: MapComponentProps) {
  //   店舗情報格納用State
  const [stores, setStores] = useState<Store[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);

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
      // 獲得データstores[]の中身を店舗情報として取得
      .then((data) => setStores(data.stores ?? []));
  }, []);

  // storesの中に実際に登場するカテゴリー名だけを重複無しで抽出する。
  // ShowStoreCategoryを別途呼ばなくても、今表示している店舗データだけから作れる。
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

  const handleCategoryFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setCategoryFilter(e.target.value);
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

      <main>
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

        <table>
          <thead>
            <tr>
              <th>店舗名</th>
              <th>カテゴリー</th>
              <th>予算帯</th>
              <th>詳細</th>
            </tr>
          </thead>
          <tbody>
            {filteredStores.map((store) => (
              <tr key={store.place_id}>
                <td>{store.title}</td>
                <td>{store.store_category_name}</td>
                <td>{formatBudgetBand(store.avg_price)}</td>
                <td>
                  {/* 地図はStoreDetailPage側に移したため、ここは
                      詳細画面への遷移ボタンのみにした */}
                  <button
                    onClick={() => onNavigate("store-detail", store.place_id)}
                  >
                    詳細を見る
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
