import type { Metadata } from "next";
import DashboardHome from "./DashboardHome";

export const metadata: Metadata = {
  title: "Organizations",
};

export default function DashboardPage() {
  return <DashboardHome />;
}
