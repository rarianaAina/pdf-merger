"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    setFiles(Array.from(event.target.files));
  };

  const mergePDFs = async () => {
    if (files.length < 2) {
      alert("Veuillez sélectionner au moins deux fichiers PDF.");
      return;
    }

    try {
      setLoading(true);

      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);

        const copiedPages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices()
        );

        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const pdfBytes = await mergedPdf.save();

    const blob = new Blob([new Uint8Array(pdfBytes)], {
      type: "application/pdf",
    });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "pdf-fusionne.pdf";
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };
return (
  <main className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-purple-100 flex items-center justify-center p-6">
    <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl p-8">

      <div className="text-center">
        <div className="text-6xl mb-3">📄💖</div>

        <h1 className="text-3xl font-bold text-pink-600">
          Fusionner des PDF
        </h1>

        <p className="text-gray-500 mt-2">
          Pour Colombe ❤️
        </p>

        <p className="text-sm text-gray-400 mt-1">
          Développé par Rariana
        </p>
      </div>

      <div className="mt-8">
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          className="block w-full rounded-xl border border-pink-300 p-3 file:mr-4 file:rounded-lg file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-white hover:file:bg-pink-600 cursor-pointer"
        />
      </div>

      <div className="mt-8 rounded-2xl bg-pink-50 p-5 min-h-[150px]">
        {files.length === 0 ? (
          <p className="text-center text-gray-500">
            Aucun fichier sélectionné
          </p>
        ) : (
          <>
            <h3 className="font-semibold text-pink-700 mb-3">
              Fichiers sélectionnés
            </h3>

            <ol className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-white p-3 shadow"
                >
                  <span className="truncate">
                    📄 {file.name}
                  </span>

                  <span className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(0)} Ko
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <button
        onClick={mergePDFs}
        disabled={loading || files.length < 2}
        className="mt-8 w-full rounded-xl bg-pink-500 py-4 text-lg font-semibold text-white transition hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {loading ? "Fusion en cours..." : "Fusionner les PDF"}
      </button>

      <p className="mt-6 text-center text-xs text-gray-400">
        Les fichiers restent sur votre appareil.
        <br />
        Aucun document n'est envoyé sur Internet.
      </p>

    </div>
  </main>
);
}