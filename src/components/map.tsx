"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export const MegamoriMap = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const API_KEY =
    "v1.public.eyJqdGkiOiJlNjhkZGQ4Yi05MjQ5LTRlYmMtYWNhNS0wMmU2YWFkN2ZhYzEifQzP9EjyRDXQe_M9nRAtQHSLXMvu8R1is85g9lMMIKF1KID6a6Y6dRqFONBIycEyVFTfQOT_h7cK6iK850N83bWrHExKP92x-k-X_uTbfUiMJuklS9ceEOUR2upR4QWPVdaV_KC8X0y9XDO528yELT2KFRFatAIdzIlWBcqmA89lRFM9SiNaiMaYZ4eJGlX4izovS5pCGkBqnqJyfoCvGbeUdPnc2XS4C0naeZxfewrm0RM64XvWU42_KQG89p6RQkH07gxIf5BT_YgsdNwoJVUmFpQK_Bk1_9-b0hw9SC-7NuSF84gP-Mzin_HsEgkF4QYJB_8l0sD7D7_5VnCBNqY.YTAwN2QzYTQtMjA4OC00M2Q5LWE5ZTUtYjk4Y2U1YWUxY2Uy";

  const mapName = "MegamoriMap";
  const region = "ap-northeast-1";

  // 地図の中心(札幌駅)
  const initialLat: number = 43.06882911246343;
  const initialLon: number = 141.35077817693812;
  const initialZoom: number = 13;

  useEffect(() => {
    // 既に地図が初期化されている場合はスキップ（二重描画防止）
    if (mapRef.current || !mapContainer.current) return;

    // 地図の初期化（HTMLのscriptタグ内でやっていたことと全く同じ記述）
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${API_KEY}`,
      center: [initialLon, initialLat],
      zoom: initialZoom,
    });

    // ナビゲーションコントロール（拡大縮小ボタン等）を追加
    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-left");

    // クリーンアップ処理（コンポーネント破棄時に地図を破棄）
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
};
