import { useEffect, useRef, useState } from "react";
// maplibre-glをインポート(V6対応版)
import * as maplibregl from "maplibre-gl";
// 地図表示の際のstylesheetを読み込み
import "maplibre-gl/dist/maplibre-gl.css";
// worker本体をViteに正しくバンドルさせて、そのURLを取得する
// (プレーンな ?url だとworkerが依存している maplibre-gl-shared.mjs が
//  一緒にバンドルされず、workerが読み込み時に失敗する)
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// アプリ起動時に一度だけ、workerの場所をMapLibreに教える
maplibregl.setWorkerUrl(workerUrl);

interface Position {
  latitude: number | null;
  longitude: number | null;
}

type Store = {
  place_id: string;
  title: string;
  avg_price: number;
  address_label: string;
  store_url: string;
  longitude: number;
  latitude: number;
};

// ★追加：App.tsx から画面切り替え関数を受け取るためのprops
interface MapComponentProps {
  onNavigate: (view: "map" | "regist-store" | "regist-menu") => void;
}

export function MapComponent({ onNavigate }: MapComponentProps) {
  // マップ表示用のDOMを取得する。
  const mapContainer = useRef<HTMLDivElement | null>(null);
  //   マップ保存用UseRef
  const mapRef = useRef<maplibregl.Map | null>(null);
  //   マーカーデータ保存用useRef
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // 現在地取得用State
  const [position, setPosition] = useState<Position>({
    latitude: null,
    longitude: null,
  });
  // 環境変数から値を取得する
  const apiKey = import.meta.env.VITE_MAP_API_KEY;
  const mapName = import.meta.env.VITE_MAP_NAME;
  const region = import.meta.env.VITE_AWS_REGION;
  //   注文履歴格納用State
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      fetch(
        "https://uay8s2uqz9.execute-api.ap-northeast-1.amazonaws.com/MegamoriMap/megamorimap/ShowMegaMap",
        {
          method: "POST",
          // HeaderにJson形式であることを示す。
          headers: {
            "Content-Type": "application/json",
          },
          // 入力データをJson形式の文字列に変換して送信。
          body: JSON.stringify({
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
          }),
        },
      )
        .then((res) => res.json())
        .then((data) => setStores(data.stores ?? []));
    });
  }, []);

  //   画面表示とともにAmazone Location ServiceのMapsAPIをたたき地図データを取得、描画する
  useEffect(() => {
    if (!mapContainer.current) return;
    if (position.latitude === null || position.longitude === null) return;
    // 接続先URLの成型：環境変数から取得した値をもとにして作成
    const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;
    // 作成する地図の設定項目を書き込んで実際にAPIからデータを取得する
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      //   地図の中心とする座標
      center: [position.longitude, position.latitude],
      //   地図の縮尺レベルを定める
      zoom: 16,
    });
    mapRef.current = map;
    // 拡大/縮小ボタンの追加
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // 地図にユーザーの位置情報を表示するコントロールを追加
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
    );

    // コンポーネントが描画されなくなると同時にデータを消去する処理(メモリリーク対策)
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [position]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return; // 地図がまだ無ければ何もしない

    // 前回分のマーカーを消してから作り直す（重複防止）
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    stores.forEach((store) => {
      const popup = new maplibregl.Popup({ offset: 24 }).setHTML(
        `<strong>${store.title}</strong><br/>${store.address_label}`,
      );

      const marker = new maplibregl.Marker({ color: "#c8442d" })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [stores]);

  return (
    <div className="megamap">
      <h1>メガ盛りマップ</h1>

      {/* ★追加：登録ページへの移動ボタン */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => onNavigate("regist-store")}>
          店舗を登録する
        </button>
        <button onClick={() => onNavigate("regist-menu")}>
          メニューを登録する
        </button>
      </div>

      <div ref={mapContainer} style={{ width: "70%", height: "500px" }} />
    </div>
  );
}
