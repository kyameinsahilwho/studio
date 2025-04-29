import { Header } from "@/components/header";
import { PdfFusion } from "@/components/pdf-fusion";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <PdfFusion />
      </main>
      <footer className="text-center py-4 text-muted-foreground text-sm">
        © {new Date().getFullYear()} PDFusion. All rights reserved.
      </footer>
    </div>
  );
}
