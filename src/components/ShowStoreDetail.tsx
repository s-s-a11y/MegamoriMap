import { useEffect, useState, useRef } from "react";
import { formatBudgetBand } from "../utils/FormatPrice"; // 実際の配置場所に合わせてパスを調整してください
import { UpdateStoreModal } from "../modal/UpdateStoreModal"; // 実際の配置場所に合わせてパスを調整してください
import { UpdateMenuModal } from "../modal/UpdateMenuModal"; // 実際の配置場所に合わせてパスを調整してください
import "../css_components/ShowStoreDetail.css";
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

// 店舗のコメント1件分(ShowStoreDetail.py / AddStoreComment.pyの1件と一致)
interface StoreComment {
  comment: string;
  posted_at: string;
}

// ShowStoreDetail Lambdaが返す、1店舗分の詳細情報
interface StoreDetail {
  place_id: string;
  title: string;
  avg_price: number;
  address_label: string;
  store_url: string;
  store_category_name: string;
  comments: StoreComment[];
  image_url: string;
  longitude: number;
  latitude: number;
}

// ShowStoreMenus Lambdaが返す、メニュー1件分の情報
interface Menu {
  menu_id: string;
  menu_name: string;
  price: number;
  memo: string;
  image_url: string;
}

type StoreStatus = "loading" | "success" | "error" | "not-found";
type MenuStatus = "loading" | "success" | "error";
type DeleteStatus = "idle" | "loading" | "error";

// App.tsx から画面切り替え関数を受け取るためのprops
// ★変更：メニュー登録画面へplace_id・店舗名を渡して遷移できるよう型を拡張
interface StoreDetailPageProps {
  placeId: string;
  onNavigate: (
    view: "map" | "regist-store" | "regist-menu",
    placeId?: string,
    storeName?: string,
  ) => void;
}

// ------------------------------------------------------------
// エラーメッセージの読み取り
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
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const apiKey = import.meta.env.VITE_MAP_API_KEY;
  const mapName = import.meta.env.VITE_MAP_NAME;
  const region = import.meta.env.VITE_AWS_REGION;

  const [position, setPosition] = useState<Position>({
    latitude: null,
    longitude: null,
  });

  // ★追加：地図を「1回タップするまで操作不可」にするための状態
  const [isMapActive, setIsMapActive] = useState(false);

  // ---- 店舗情報まわりの状態 ----
  const [store, setStore] = useState<StoreDetail | null>(null);
  const [storeStatus, setStoreStatus] = useState<StoreStatus>("loading");
  const [storeErrorMessage, setStoreErrorMessage] = useState<string | null>(
    null,
  );
  const [storeRefreshKey, setStoreRefreshKey] = useState(0);

  // ---- メニュー一覧まわりの状態 ----
  const [menus, setMenus] = useState<Menu[]>([]);
  const [menuStatus, setMenuStatus] = useState<MenuStatus>("loading");
  const [menuErrorMessage, setMenuErrorMessage] = useState<string | null>(null);
  const [menuRefreshKey, setMenuRefreshKey] = useState(0);

  // ---- 店舗の更新・削除まわりの状態 ----
  const [isUpdateStoreModalOpen, setIsUpdateStoreModalOpen] = useState(false);
  const [isStoreDeleteConfirmOpen, setIsStoreDeleteConfirmOpen] =
    useState(false);
  const [storeDeleteStatus, setStoreDeleteStatus] =
    useState<DeleteStatus>("idle");
  const [storeDeleteError, setStoreDeleteError] = useState<string | null>(null);

  // ---- メニューの更新・削除まわりの状態 ----
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuPendingDelete, setMenuPendingDelete] = useState<Menu | null>(null);
  const [menuDeleteStatus, setMenuDeleteStatus] =
    useState<DeleteStatus>("idle");
  const [menuDeleteError, setMenuDeleteError] = useState<string | null>(null);

  const deleteConfirmDialogRef = useRef<HTMLDialogElement | null>(null);
  const menuDeleteConfirmDialogRef = useRef<HTMLDialogElement | null>(null);

  // ---- コメント追加まわりの状態 ----
  const [newComment, setNewComment] = useState("");
  const [addCommentStatus, setAddCommentStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [addCommentError, setAddCommentError] = useState<string | null>(null);

  // 現在地座標の取得
  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    });
  }, []);

  // 店舗情報の取得
  useEffect(() => {
    let cancelled = false;

    setStoreStatus("loading");
    setStoreErrorMessage(null);

    const apiUrl =
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/stores/detail";

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    })
      .then(async (res) => {
        if (cancelled) return;

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
  }, [placeId, storeRefreshKey]);

  // 地図は現在地を中心に表示しつつ、マーカーは店舗の座標に立てる。
  useEffect(() => {
    if (!mapContainer.current) return;
    if (position.latitude === null || position.longitude === null) return;
    if (!store) return;

    const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [position.longitude, position.latitude],
      zoom: 16,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const geolocateControl = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    });
    map.addControl(geolocateControl);

    map.on("load", () => {
      geolocateControl.trigger();
    });

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

  // メニュー一覧の取得
  useEffect(() => {
    let cancelled = false;

    setMenuStatus("loading");
    setMenuErrorMessage(null);

    const apiUrl =
      "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/stores/menus";

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
  }, [placeId, menuRefreshKey]);

  // 店舗削除の確認ダイアログの開閉制御
  useEffect(() => {
    const dialog = deleteConfirmDialogRef.current;
    if (!dialog) return;
    if (isStoreDeleteConfirmOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isStoreDeleteConfirmOpen && dialog.open) {
      dialog.close();
    }
  }, [isStoreDeleteConfirmOpen]);

  // メニュー削除の確認ダイアログの開閉制御
  useEffect(() => {
    const dialog = menuDeleteConfirmDialogRef.current;
    if (!dialog) return;
    if (menuPendingDelete && !dialog.open) {
      dialog.showModal();
    } else if (!menuPendingDelete && dialog.open) {
      dialog.close();
    }
  }, [menuPendingDelete]);

  // コメントを1件追加する
  const handleAddComment = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!store || !newComment.trim()) return;

    setAddCommentStatus("loading");
    setAddCommentError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/stores/addcomment";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: store.place_id, comment: newComment }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      setNewComment("");
      setAddCommentStatus("idle");
      setStoreRefreshKey((key) => key + 1);
    } catch (err) {
      setAddCommentError(
        err instanceof Error ? err.message : "コメントの追加に失敗しました",
      );
      setAddCommentStatus("error");
    }
  };

  // 店舗の削除を確定する
  const handleConfirmDeleteStore = async () => {
    if (!store) return;

    setStoreDeleteStatus("loading");
    setStoreDeleteError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/stores/delete";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: store.place_id }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      onNavigate("map");
    } catch (err) {
      setStoreDeleteError(
        err instanceof Error ? err.message : "削除に失敗しました",
      );
      setStoreDeleteStatus("error");
    }
  };

  // メニューの削除を確定する
  const handleConfirmDeleteMenu = async () => {
    if (!menuPendingDelete) return;

    setMenuDeleteStatus("loading");
    setMenuDeleteError(null);

    try {
      const apiUrl =
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/menus/delete";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_id: menuPendingDelete.menu_id }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      setMenuPendingDelete(null);
      setMenuDeleteStatus("idle");
      setMenuRefreshKey((key) => key + 1);
      setStoreRefreshKey((key) => key + 1);
    } catch (err) {
      setMenuDeleteError(
        err instanceof Error ? err.message : "削除に失敗しました",
      );
      setMenuDeleteStatus("error");
    }
  };

  return (
    <div>
      {/* ★変更：h1・「← 戻る」ボタンを削除(共通ヘッダー側に移した)。
          代わりに「メニューを登録する」ボタンをここに追加。 */}
      {storeStatus === "success" && store && (
        <nav>
          <button
            onClick={() =>
              onNavigate("regist-menu", store.place_id, store.title)
            }
          >
            メニューを登録する
          </button>

          <div className="detail-actions">
            <button onClick={() => setIsUpdateStoreModalOpen(true)}>
              更新
            </button>
            <button onClick={() => setIsStoreDeleteConfirmOpen(true)}>
              削除
            </button>
          </div>
        </nav>
      )}

      <main>
        {storeStatus === "loading" && <p>読み込み中...</p>}

        {storeStatus === "not-found" && (
          <p>指定された店舗が見つかりませんでした。</p>
        )}

        {storeStatus === "error" && <p role="alert">{storeErrorMessage}</p>}

        {storeStatus === "success" && store && (
          <>
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

        {/* ★変更：地図を囲うラッパーに、1回タップするまでの操作不可オーバーレイを重ねる */}
        <div className="map-wrapper">
          <div id="map-canvas" ref={mapContainer} />
          {!isMapActive && (
            <div
              className="map-activate-overlay"
              onClick={() => setIsMapActive(true)}
            >
              <p>タップして地図を操作する</p>
            </div>
          )}
        </div>

        {/* --- コメント --- */}
        {storeStatus === "success" && store && (
          <section>
            <h2>コメント</h2>

            {store.comments.length === 0 && <p>まだコメントはありません。</p>}

            {store.comments.length > 0 && (
              <ul>
                {store.comments.map((c, index) => (
                  <li key={index}>
                    <p>{c.comment}</p>
                    <small>{c.posted_at}</small>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddComment}>
              <label>
                コメントを追加
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  required
                />
              </label>

              {addCommentStatus === "error" && (
                <p role="alert">{addCommentError}</p>
              )}

              <button
                type="submit"
                disabled={addCommentStatus === "loading" || !newComment.trim()}
              >
                {addCommentStatus === "loading"
                  ? "追加中..."
                  : "コメントを追加する"}
              </button>
            </form>
          </section>
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

            {/* ★変更：menu-listクラスを付け、横並び+左右スクロールにする */}
            {menuStatus === "success" && menus.length > 0 && (
              <ul className="menu-list">
                {menus.map((menu) => (
                  <li key={menu.menu_id} className="menu-list__item">
                    {menu.image_url && (
                      <img src={menu.image_url} alt={menu.menu_name} />
                    )}
                    <strong>{menu.menu_name}</strong>
                    <br />
                    <span>¥{menu.price.toLocaleString()}</span>
                    {menu.memo && <p>{menu.memo}</p>}

                    <div className="menu-card-actions">
                      <button onClick={() => setEditingMenu(menu)}>更新</button>
                      <button onClick={() => setMenuPendingDelete(menu)}>
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* 店舗情報更新モーダル(別ファイル) */}
      {store && (
        <UpdateStoreModal
          store={store}
          isOpen={isUpdateStoreModalOpen}
          onClose={() => setIsUpdateStoreModalOpen(false)}
          onUpdated={() => setStoreRefreshKey((key) => key + 1)}
        />
      )}

      {/* 店舗削除の確認ダイアログ */}
      <dialog
        ref={deleteConfirmDialogRef}
        onClose={() => setIsStoreDeleteConfirmOpen(false)}
      >
        <p>「{store?.title}」を削除しますか？</p>
        {storeDeleteStatus === "error" && (
          <p role="alert">{storeDeleteError}</p>
        )}
        <div>
          <button
            type="button"
            onClick={() => setIsStoreDeleteConfirmOpen(false)}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteStore}
            disabled={storeDeleteStatus === "loading"}
          >
            {storeDeleteStatus === "loading" ? "削除中..." : "削除する"}
          </button>
        </div>
      </dialog>

      {/* メニュー更新モーダル(別ファイル) */}
      {editingMenu && (
        <UpdateMenuModal
          menu={editingMenu}
          isOpen={editingMenu !== null}
          onClose={() => setEditingMenu(null)}
          onUpdated={() => {
            setMenuRefreshKey((key) => key + 1);
            setStoreRefreshKey((key) => key + 1);
          }}
        />
      )}

      {/* メニュー削除の確認ダイアログ */}
      <dialog
        ref={menuDeleteConfirmDialogRef}
        onClose={() => setMenuPendingDelete(null)}
      >
        <p>「{menuPendingDelete?.menu_name}」を削除しますか？</p>
        {menuDeleteStatus === "error" && <p role="alert">{menuDeleteError}</p>}
        <div>
          <button type="button" onClick={() => setMenuPendingDelete(null)}>
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteMenu}
            disabled={menuDeleteStatus === "loading"}
          >
            {menuDeleteStatus === "loading" ? "削除中..." : "削除する"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
