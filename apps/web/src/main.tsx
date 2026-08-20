import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Legal } from "./Legal";
import { Shell } from "./Shell";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="privacy" element={<Legal kind="privacy" />} />
          <Route path="terms" element={<Legal kind="terms" />} />
          <Route path="guidelines" element={<Legal kind="guidelines" />} />
          <Route path="support" element={<Legal kind="support" />} />
          <Route path="delete-account" element={<Legal kind="deleteAccount" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

function Home() {
  return (
    <main className="page">
      <p className="eyebrow">iPhone + Pixel</p>
      <h1>One poll. Your call. Next.</h1>
      <p className="lede">
        Pollscale is a social polling app. You see one poll at a time, vote or skip, get the split
        immediately, and move on. No comments. No changing your mind. Everyone can see every live poll.
      </p>
      <div className="stores">
        <span className="store">App Store — coming soon</span>
        <span className="store">Google Play — coming soon</span>
      </div>
      <p className="fine">
        13+ · English only · Politics is allowed · NSFW and self-harm are not.
      </p>
    </main>
  );
}
