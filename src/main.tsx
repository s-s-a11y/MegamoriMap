import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "react-oidc-context";

// Cognitoの、Googleを介したログインに必要な設定一式。
// phoneスコープは今回のアプリで使わないため、openid/email/profileのみ要求する。
const cognitoAuthConfig = {
  authority:
    "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_ClP5cwKis",
  client_id: "3ff8jc8a229g96fbpv7lpe0qhm",
  redirect_uri: "https://main.dc2x1tgfccujd.amplifyapp.com/",
  response_type: "code",
  scope: "openid email profile",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </StrictMode>,
);
