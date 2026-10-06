import { useEffect, useRef } from "react";
// maplibre-glをインポート(V6対応版)。この部品はHomeから遅延読み込みされるため、
// トップ画面を開いただけでは地図ライブラリは読み込まれない
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { formatBudgetBand, getBudgetSourcePrice } from "../utils/FormatPrice";
import "../css_components/AllStoresMap.css";

maplibregl.setWorkerUrl(workerUrl);

// ★新規(C44)：トップの「全店舗を地図で見る」から開く、全店舗のマーカー付き地図(モーダル)。

export interface MapStore {
  place_id: string;
  title: string;
  longitude: number;
  latitude: number;
  store_category_name: string;
  meal_time: "lunch" | "dinner" | "both";
  avg_price: number;
  price_per_person: number;
}

interface AllStoresMapProps {
  stores: MapStore[];
  onSelect: (placeId: string) => void;
  onClose: () => void;
}

const MEAL_TIME_LABELS: Record<string, string> = { lunch: "昼", dinner: "晩", both: "昼・晩" };
// マーカーの色：昼はからし色、晩は濃い茶色(店舗カードのラベルと同じ色分け)
// ★変更(C71)：「昼・晩どちらも」の店は柿色
const MARKER_COLORS: Record<string, string> = { lunch: "#e8a33d", dinner: "#241511", both: "#d9481e" };
// 店舗が1件も無いときの地図の中心(池袋駅付近)
const FALLBACK_CENTER: [number, number] = [139.7109, 35.7295];

// 吹き出しの中身。店名などは利用者が登録した文字列のため、HTMLとして解釈させず文字として入れる
function buildPopupContent(store: MapStore, onSelect: (placeId: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "all-stores-map__popup";
  const name = document.createElement("strong");
  name.textContent = store.title;
  const meta = document.createElement("span");
  meta.textContent = `${store.store_category_name}・${MEAL_TIME_LABELS[store.meal_time] ?? store.meal_time}`;
  const price = document.createElement("span");
  price.textContent = formatBudgetBand(getBudgetSourcePrice(store));
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "詳細を見る";
  button.addEventListener("click", () => onSelect(store.place_id));
  root.append(name, meta, price, button);
  return root;
}

export function AllStoresMap({ stores, onSelect, onClose }: AllStoresMapProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);

  const apiKey = import.meta.env.VITE_MAP_API_KEY;
  const mapName = import.meta.env.VITE_MAP_NAME;
  const region = import.meta.env.VITE_AWS_REGION;

  // この部品は開いている間だけ存在するため、表示されたらすぐモーダルとして開く
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
    const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: FALLBACK_CENTER,
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    // 全店舗が入る範囲に合わせて表示する
    if (stores.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      stores.forEach((s) => bounds.extend([s.longitude, s.latitude]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 0 });
    }

    stores.forEach((store) => {
      const popup = new maplibregl.Popup({ offset: 28, closeButton: false }).setDOMContent(
        buildPopupContent(store, onSelect),
      );
      new maplibregl.Marker({ color: MARKER_COLORS[store.meal_time] ?? "#c8442d" })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(popup)
        .addTo(map);
    });

    return () => map.remove();
  }, [stores, onSelect, apiKey, mapName, region]);

  return (
    <dialog
      ref={dialogRef}
      className="all-stores-map"
      onClose={onClose}
      onClick={(e) => {
        // 地図の外側(背景)をクリックしたときだけ閉じる
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label="全店舗の地図"
    >
      <div className="all-stores-map__header">
        <h2>全店舗の地図（{stores.length}件）</h2>
        <span className="all-stores-map__legend">
          <span className="all-stores-map__dot all-stores-map__dot--lunch" />昼
          <span className="all-stores-map__dot all-stores-map__dot--dinner" />晩
          <span className="all-stores-map__dot all-stores-map__dot--both" />昼・晩
        </span>
        <button type="button" className="all-stores-map__close" onClick={onClose} aria-label="地図を閉じる">
          ×
        </button>
      </div>
      <div ref={mapContainer} className="all-stores-map__map" />
      <p className="all-stores-map__hint">マーカーを押すと店名と「詳細を見る」が表示されます</p>
    </dialog>
  );
}
