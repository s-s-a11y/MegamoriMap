import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// worker本体をViteに正しくバンドルさせて、そのURLを取得する
// (プレーンな ?url だとworkerが依存している maplibre-gl-shared.mjs が
//  一緒にバンドルされず、workerが読み込み時に失敗する)
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// アプリ起動時に一度だけ、workerの場所をMapLibreに教える
maplibregl.setWorkerUrl(workerUrl);

export function MapComponent() {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  const apiKey = import.meta.env.VITE_MAP_API_KEY;
  const mapName = import.meta.env.VITE_MAP_NAME;
  const region = import.meta.env.VITE_AWS_REGION;

  useEffect(() => {
    if (!mapContainer.current) return;

    const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [139.767125, 35.681236],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} style={{ width: "100%", height: "500px" }} />;
}
