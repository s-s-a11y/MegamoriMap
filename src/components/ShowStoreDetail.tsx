import { useEffect, useState, useRef } from "react";
import { formatBudgetBand } from "../utils/FormatPrice"; // 実際の配置場所に合わせてパスを調整してください
// maplibre-glをインポート(V6対応版)
import * as maplibregl from "maplibre-gl";
// 地図表示の際のstylesheetを読み込み
import "maplibre-gl/dist/maplibre-gl.css";
// worker本体をViteに正しくバンドルさせて、そのURLを取得する
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// アプリ起動時に一度だけ、workerの場所をMapLibreに教える
maplibregl.setWorkerUrl(workerUrl);

// 座標格納用typeの定義
interface Position {
  latitude: number | null;
  longitude: number | null;
}

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
  // マップ表示用のDOMを取得する。
  const mapContainer = useRef<HTMLDivElement | null>(null);
  //   マップ保存用useRef
  const mapRef = useRef<maplibregl.Map | null>(null);
  //   マーカー保存用useRef(このページでは常に「その店舗の1本」だけなので配列にしていない)
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // 環境変数から値を取得する
  const apiKey = import.meta.env.VITE_MAP_API_KEY;
  const mapName = import.meta.env.VITE_MAP_NAME;
  const region = import.meta.env.VITE_AWS_REGION;

  // 現在地取得用State(このテーマでは登録店舗が自分の近辺に限られる前提のため、
  // 地図の中心は店舗の座標ではなく、あえて現在地のままにしている)
  const [position, setPosition] = useState<Position>({
    latitude: null,
    longitude: null,
  });

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

  // 現在地座標の取得
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    });
  }, []);

  // 店舗情報の取得(地図の生成には一切関与しない、純粋なデータ取得だけに専念させる)
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

  // 地図は現在地を中心に表示しつつ、マーカーは店舗の座標に立てる。
  // マーカーの生成にはstoreの座標が必要なため、position・storeの両方が
  // 揃ってから地図を作る。
  useEffect(() => {
    if (!mapContainer.current) return;
    if (position.latitude === null || position.longitude === null) return;
    if (!store) return; // 店舗情報がまだ取得できていなければ何もしない

    const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      // 現在地を中心にする(このテーマでは登録店舗が近辺に限られる前提のため)
      center: [position.longitude, position.latitude],
      zoom: 16,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
    );

    // 店舗の位置にマーカーを立てる。storeは既に手元にあるデータなので
    // setState直後の値のズレを心配する必要が無い。
    const marker = new maplibregl.Marker({ color: "#c8442d" })
      .setLngLat([store.longitude, store.latitude])
      .addTo(map);
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [position, store]);

  // メニュー一覧の取得(店舗情報とは別のAPIなので、並行して取得する)
  useEffect(() => {
    let cancelled = false;

    setMenuStatus("loading");
    setMenuErrorMessage(null);

    const apiUrl =
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowStoreMenues";

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

              <dt>予算帯</dt>
              <dd>{formatBudgetBand(store.avg_price)}</dd>

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

        <div id="map-canvas" ref={mapContainer} />

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
