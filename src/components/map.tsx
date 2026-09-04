import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export function MapComponent() {
  const mapContainer = useRef(null);

  const apiKey =
    "v1.public.eyJqdGkiOiJlNjhkZGQ4Yi05MjQ5LTRlYmMtYWNhNS0wMmU2YWFkN2ZhYzEifQzP9EjyRDXQe_M9nRAtQHSLXMvu8R1is85g9lMMIKF1KID6a6Y6dRqFONBIycEyVFTfQOT_h7cK6iK850N83bWrHExKP92x-k-X_uTbfUiMJuklS9ceEOUR2upR4QWPVdaV_KC8X0y9XDO528yELT2KFRFatAIdzIlWBcqmA89lRFM9SiNaiMaYZ4eJGlX4izovS5pCGkBqnqJyfoCvGbeUdPnc2XS4C0naeZxfewrm0RM64XvWU42_KQG89p6RQkH07gxIf5BT_YgsdNwoJVUmFpQK_Bk1_9-b0hw9SC-7NuSF84gP-Mzin_HsEgkF4QYJB_8l0sD7D7_5VnCBNqY.YTAwN2QzYTQtMjA4OC00M2Q5LWE5ZTUtYjk4Y2U1YWUxY2Uy"; // 作成したAPIキー
  const mapName = "MegamoriMap"; // 作成したマップリソース名
  const region = "ap-northeast-1"; // リージョン

  useEffect(() => {
    if (!mapContainer.current) return;

    // APIキーを含めたスタイルURLを構築
    const styleUrl = `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${mapName}/style-descriptor?key=${apiKey}`;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [139.767125, 35.681236], // [経度, 緯度] (例: 東京駅)
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} style={{ width: "100%", height: "500px" }} />;
}
