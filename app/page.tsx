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
    <main
      style={{
        maxWidth: 700,
        margin: "50px auto",
        fontFamily: "Arial",
        textAlign: "center",
      }}
    >
      <h1>Fusionner des PDF avec Rariana le copain de Colombe</h1>

      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileChange}
      />

      <div
        style={{
          marginTop: 30,
          textAlign: "left",
        }}
      >
        {files.length === 0 ? (
          <p>Aucun fichier sélectionné.</p>
        ) : (
          <>
            <h3>Fichiers sélectionnés</h3>

            <ol>
              {files.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ol>
          </>
        )}
      </div>

      <button
        onClick={mergePDFs}
        disabled={loading || files.length < 2}
        style={{
          marginTop: 30,
          padding: "12px 30px",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        {loading ? "Fusion..." : "Fusionner les PDF"}
      </button>
    </main>
  );
}