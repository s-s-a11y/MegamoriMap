"use client";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

export const MegamoriMap = () => {
  const API_KEY =
    "v1.public.eyJqdGkiOiJlNjhkZGQ4Yi05MjQ5LTRlYmMtYWNhNS0wMmU2YWFkN2ZhYzEifQzP9EjyRDXQe_M9nRAtQHSLXMvu8R1is85g9lMMIKF1KID6a6Y6dRqFONBIycEyVFTfQOT_h7cK6iK850N83bWrHExKP92x-k-X_uTbfUiMJuklS9ceEOUR2upR4QWPVdaV_KC8X0y9XDO528yELT2KFRFatAIdzIlWBcqmA89lRFM9SiNaiMaYZ4eJGlX4izovS5pCGkBqnqJyfoCvGbeUdPnc2XS4C0naeZxfewrm0RM64XvWU42_KQG89p6RQkH07gxIf5BT_YgsdNwoJVUmFpQK_Bk1_9-b0hw9SC-7NuSF84gP-Mzin_HsEgkF4QYJB_8l0sD7D7_5VnCBNqY.YTAwN2QzYTQtMjA4OC00M2Q5LWE5ZTUtYjk4Y2U1YWUxY2Uy";

  // 地図の中心(札幌駅)
  const initialLat: number = 43.06882911246343;
  const initialLon: number = 141.35077817693812;
  const initialZoom: number = 13;

  return (
    <div className="map">
      <Map
        initialViewState={{
          longitude: initialLat,
          latitude: initialLon,
          zoom: initialZoom,
        }}
        style={{ width: "100vw", height: "100vh" }}
        mapStyle={`https://maps.geo.ap-northeast-1.amazonaws.com/v2/styles/Standard/descriptor?key=${API_KEY}`}
      />
    </div>
  );
};
