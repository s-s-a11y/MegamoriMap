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

// 座標格納用typeの定義
interface Position {
  latitude: number | null;
  longitude: number | null;
}
// 店舗情報格納用typeの定義
type Store = {
  place_id: string;
  title: string;
  avg_price: number;
  address_label: string;
  store_url: string;
  longitude: number;
  latitude: number;
};

// App.tsx から画面切り替え関数を受け取るためのprops
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
  //   店舗情報格納用State
  const [stores, setStores] = useState<Store[]>([]);

  //   一番最初に行うuseEffect　現在地座標と店舗情報の獲得を行う
  useEffect(() => {
    // 現在地座標を獲得
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      //   Lambda関数　ShowMegaMapにFetch
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
        // 獲得データstores[]の中身を店舗情報として取得
        .then((data) => setStores(data.stores ?? []));
    });
  }, []);

  //   現在地情報獲得とともにAmazone Location ServiceのMapsAPIをたたき地図データを取得、描画する
  useEffect(() => {
    if (!mapContainer.current) return;
    // 現在地情報がなければキャンセル
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
    // マップをuseRefに格納(マーカー表示処理に使用するため)
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

  //   店舗情報が読み込まれた際のuseEffect
  useEffect(() => {
    const map = mapRef.current; //マップをuseRefから取得
    if (!map) return; // 地図がまだ無ければ何もしない

    // 前回分のマーカーを消してから作り直す（重複防止）
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // 獲得店舗情報の分マーカーを作成　for store in storesのような働き
    stores.forEach((store) => {
      // ポップアップの作成
      const popup = new maplibregl.Popup({ offset: 24 }).setHTML(
        `<strong>${store.title}</strong><br/>${store.address_label}`,
      );
      // マーカーの作成
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
      <table border={1}>
        <tr>
          <th>酒名</th>
          <th>価格</th>
          <th>数量</th>
          <th>操作</th>
        </tr>
        {stores.map((store) => (
          <tr key={store.place_id}>
            {/* // 酒IDを基準にリスト表示 */}
            <td>
              <span>{store.title}</span>
            </td>
            <td>
              <span>円</span>
            </td>
            <td>
              <span></span>
            </td>
            <td>
              <span>
                {/* 文字列化して表示 */}
                <button>カートに追加</button>
              </span>{" "}
            </td>
          </tr>
        ))}
      </table>

      {/* 登録ページへの移動ボタン */}
      <div style={{ gap: 8, marginBottom: 12 }}>
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
