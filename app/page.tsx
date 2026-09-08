"use client";

import { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

type SelectedFile = {
  id: string;
  file: File;
};

// Le FileList du navigateur ne conserve pas l'ordre des clics : on identifie
// chaque fichier pour pouvoir le réordonner et le retirer sans ambiguïté.
const fileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

export default function Home() {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    const added = Array.from(event.target.files).map((file) => ({
      id: String(nextId.current++),
      file,
    }));

    // Les nouvelles sélections s'ajoutent à la fin au lieu de tout écraser.
    setFiles((current) => {
      const seen = new Set(current.map(({ file }) => fileKey(file)));

      return [
        ...current,
        ...added.filter(({ file }) => !seen.has(fileKey(file))),
      ];
    });

    // Permet de re-sélectionner un fichier qui vient d'être retiré.
    event.target.value = "";
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];

      return next;
    });
  };

  const removeFile = (id: string) => {
    setFiles((current) => current.filter((entry) => entry.id !== id));
  };

  const mergePDFs = async () => {
    if (files.length < 2) {
      alert("Veuillez sélectionner au moins deux fichiers PDF.");
      return;
    }

    try {
      setLoading(true);

      const mergedPdf = await PDFDocument.create();

      for (const { file } of files) {
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

          <p className="mt-2 text-xs text-gray-400">
            Vous pouvez sélectionner vos fichiers en plusieurs fois : ils
            s&apos;ajoutent à la liste.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-pink-50 p-5 min-h-[150px]">
          {files.length === 0 ? (
            <p className="text-center text-gray-500">
              Aucun fichier sélectionné
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-semibold text-pink-700">
                  Ordre de fusion
                </h3>

                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-gray-400 hover:text-pink-600 transition"
                >
                  Tout retirer
                </button>
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Les pages seront assemblées dans cet ordre. Utilisez les
                flèches pour le modifier.
              </p>

              <ol className="space-y-2">
                {files.map(({ id, file }, index) => (
                  <li
                    key={id}
                    className="flex items-center gap-3 rounded-lg bg-white p-3 shadow"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-semibold text-white">
                      {index + 1}
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {file.name}
                    </span>

                    <span className="shrink-0 text-xs text-gray-400">
                      {(file.size / 1024).toFixed(0)} Ko
                    </span>

                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => moveFile(index, -1)}
                        disabled={index === 0}
                        aria-label={`Déplacer ${file.name} vers le haut`}
                        className="rounded px-1.5 py-0.5 text-gray-500 transition hover:bg-pink-100 hover:text-pink-600 disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent"
                      >
                        ↑
                      </button>

                      <button
                        onClick={() => moveFile(index, 1)}
                        disabled={index === files.length - 1}
                        aria-label={`Déplacer ${file.name} vers le bas`}
                        className="rounded px-1.5 py-0.5 text-gray-500 transition hover:bg-pink-100 hover:text-pink-600 disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent"
                      >
                        ↓
                      </button>

                      <button
                        onClick={() => removeFile(id)}
                        aria-label={`Retirer ${file.name}`}
                        className="rounded px-1.5 py-0.5 text-gray-400 transition hover:bg-pink-100 hover:text-pink-600"
                      >
                        ✕
                      </button>
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
          Aucun document n&apos;est envoyé sur Internet.
        </p>

      </div>
    </main>
  );
}
