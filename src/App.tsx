import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "@/pages/Dashboard";
import Configuration from "@/pages/Configuration";
import Screening from "@/pages/Screening";
import Appraisal from "@/pages/Appraisal";
import Extraction from "@/pages/Extraction";
import Synthesis from "@/pages/Synthesis";
import Export from "@/pages/Export";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="review">
          <Route index element={<Navigate to="config" replace />} />
          <Route path="config" element={<Configuration />} />
          <Route path="screening" element={<Screening />} />
          <Route path="appraisal" element={<Appraisal />} />
          <Route path="extraction" element={<Extraction />} />
          <Route path="synthesis" element={<Synthesis />} />
          <Route path="export" element={<Export />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
