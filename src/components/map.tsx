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

export function MapComponent() {
  // マップ表示用のDOMを取得する。
  const mapContainer = useRef<HTMLDivElement | null>(null);
  // 現在地取得用State
  const [position, setPosition] = useState<Position>({
    latitude: null,
    longitude: null,
  });
  // 環境変数から値を取得する
  const apiKey = import.meta.env.VITE_MAP_API_KEY;
  const mapName = import.meta.env.VITE_MAP_NAME;
  const region = import.meta.env.VITE_AWS_REGION;

  useEffect(() => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
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
    return () => map.remove();
  }, [position]);

  return <div ref={mapContainer} style={{ width: "100%", height: "500px" }} />;
}
