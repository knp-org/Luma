import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

import { ModalProvider } from "./providers/ModalProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ModalProvider>
      <App />
    </ModalProvider>
  </React.StrictMode>,
);
