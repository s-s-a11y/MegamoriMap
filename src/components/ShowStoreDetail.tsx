import { useEffect, useState } from "react";

// ShowStoreDetail Lambdaが返す、1店舗分の詳細情報
// (ShowStoreDetail.pyのformat_store()の出力に合わせている)
interface StoreDetail {
  place_id: string;
  title: string;
  avg_price: number;
  address_label: string;
  store_url: string;
  store_category_name: string;
  comment: string;
  image_url: string;
  longitude: number;
  latitude: number;
}

// ShowStoreMenus Lambdaが返す、メニュー1件分の情報
// (ShowStoreMenus.pyのformat_menus()の出力に合わせている)
interface Menu {
  menu_id: number;
  menu_name: string;
  price: number;
  memo: string;
  image_url: string;
}

type StoreStatus = "loading" | "success" | "error" | "not-found";
type MenuStatus = "loading" | "success" | "error";

// App.tsx から画面切り替え関数を受け取るためのprops
interface StoreDetailPageProps {
  placeId: string;
  onNavigate: (view: "map" | "regist-store" | "regist-menu") => void;
}

// ------------------------------------------------------------
// エラーメッセージの読み取り
// ShowStoreDetail.py / ShowStoreMenus.py は 400のときはJSON({"message": "..."})、
// 401/500のときはプレーン文字列を返すので、両方に対応できるようにする
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

export function StoreDetailPage({ placeId, onNavigate }: StoreDetailPageProps) {
  // ---- 店舗情報まわりの状態 ----
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [storeStatus, setStoreStatus] = useState<StoreStatus>("loading");
  const [storeErrorMessage, setStoreErrorMessage] = useState<string | null>(
    null,
  );

  // ---- メニュー一覧まわりの状態 ----
  const [menus, setMenus] = useState<Menu[]>([]);
  const [menuStatus, setMenuStatus] = useState<MenuStatus>("loading");
  const [menuErrorMessage, setMenuErrorMessage] = useState<string | null>(null);

  // 店舗情報の取得
  useEffect(() => {
    let cancelled = false;

    setStoreStatus("loading");
    setStoreErrorMessage(null);

    const apiUrl =
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowStoreDetail";

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    })
      .then(async (res) => {
        if (cancelled) return;

        // 404: 該当する店舗が存在しない
        if (res.status === 404) {
          setStoreStatus("not-found");
          return;
        }

        if (!res.ok) {
          throw new Error(await readErrorMessage(res));
        }

        const data = (await res.json()) as StoreDetail;
        setStore(data);
        setStoreStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setStoreErrorMessage(
          err instanceof Error ? err.message : "店舗情報の取得に失敗しました",
        );
        setStoreStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  // メニュー一覧の取得(店舗情報とは別のAPIなので、並行して取得する)
  useEffect(() => {
    let cancelled = false;

    setMenuStatus("loading");
    setMenuErrorMessage(null);

    const apiUrl =
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowStoreMenus";

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    })
      .then(async (res) => {
        if (cancelled) return;

        if (!res.ok) {
          throw new Error(await readErrorMessage(res));
        }

        const data = await res.json();
        setMenus(data.menus ?? []);
        setMenuStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setMenuErrorMessage(
          err instanceof Error
            ? err.message
            : "メニュー情報の取得に失敗しました",
        );
        setMenuStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  return (
    <div>
      <nav>
        <button onClick={() => onNavigate("map")}>← 地図に戻る</button>
      </nav>

      <main>
        <h1>店舗詳細</h1>

        {storeStatus === "loading" && <p>読み込み中...</p>}

        {storeStatus === "not-found" && (
          <p>指定された店舗が見つかりませんでした。</p>
        )}

        {storeStatus === "error" && <p role="alert">{storeErrorMessage}</p>}

        {storeStatus === "success" && store && (
          <>
            {/* 店舗の写真。未登録(空文字)なら表示自体をスキップする */}
            {store.image_url ? (
              <img src={store.image_url} alt={`${store.title}の店舗写真`} />
            ) : (
              <p>店舗写真はまだ登録されていません。</p>
            )}

            <dl>
              <dt>店舗名</dt>
              <dd>{store.title}</dd>

              <dt>カテゴリー</dt>
              <dd>{store.store_category_name || "未設定"}</dd>

              <dt>住所</dt>
              <dd>{store.address_label}</dd>

              <dt>平均価格</dt>
              <dd>
                {store.avg_price > 0
                  ? `¥${store.avg_price.toLocaleString()}`
                  : "-"}
              </dd>

              {store.comment && (
                <>
                  <dt>コメント</dt>
                  <dd>{store.comment}</dd>
                </>
              )}

              {store.store_url && (
                <>
                  <dt>店舗ページ</dt>
                  <dd>
                    <a href={store.store_url} target="_blank" rel="noreferrer">
                      {store.store_url}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </>
        )}

        {/* --- メニュー一覧 --- */}
        {storeStatus === "success" && (
          <section>
            <h2>メニュー</h2>

            {menuStatus === "loading" && <p>メニューを読み込み中...</p>}
            {menuStatus === "error" && <p role="alert">{menuErrorMessage}</p>}

            {menuStatus === "success" && menus.length === 0 && (
              <p>登録されているメニューはまだありません。</p>
            )}

            {menuStatus === "success" && menus.length > 0 && (
              <ul>
                {menus.map((menu) => (
                  <li key={menu.menu_id}>
                    {menu.image_url && (
                      <img src={menu.image_url} alt={menu.menu_name} />
                    )}
                    <strong>{menu.menu_name}</strong>
                    <span>¥{menu.price.toLocaleString()}</span>
                    {menu.memo && <p>{menu.memo}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
