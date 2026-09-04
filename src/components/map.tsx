import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export function MapComponent() {
  const mapContainer = useRef<HTMLDivElement | null>(null);

  // 本番運用前に必ず環境変数化し、Amplifyコンソールの
  // Environment variables にも同じキーで設定すること（Viteはビルド時に埋め込むため）
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
