"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PDFDocument } from "pdf-lib";

type FileKind = "pdf" | "image";

type SelectedFile = {
  id: string;
  file: File;
  kind: FileKind;
  previewUrl?: string;
};

// Format A4 en points PDF (portrait).
const A4: [number, number] = [595.28, 841.89];
const PAGE_MARGIN = 28; // ≈ 1 cm
const MAX_IMAGE_SIDE = 2480; // largeur d'un A4 à 300 dpi

// Le FileList du navigateur ne conserve pas forcément l'ordre des clics : on
// identifie chaque fichier pour pouvoir le réordonner et le retirer.
const fileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

// Certains fichiers venant de l'app Fichiers d'iOS n'ont pas de type MIME.
const getKind = (file: File): FileKind | null => {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return "pdf";
  }

  if (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name)
  ) {
    return "image";
  }

  return null;
};

// Décode l'image avec le navigateur puis la ré-encode en JPEG : couvre le HEIC
// des iPhone (que pdf-lib ne lit pas), applique l'orientation EXIF et réduit
// les photos trop lourdes pour la mémoire de Safari.
const imageToJpeg = async (file: File) => {
  const url = URL.createObjectURL(file);

  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();

    const scale = Math.min(
      1,
      MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight)
    );
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponible");

    // Fond blanc : la transparence d'un PNG deviendrait noire en JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );

    // Safari iOS ne libère la mémoire du canvas qu'une fois sa taille remise à 0.
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) throw new Error("Conversion en JPEG impossible");

    return { bytes: await blob.arrayBuffer(), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
};

const addPdfPages = async (mergedPdf: PDFDocument, file: File) => {
  const pdf = await PDFDocument.load(await file.arrayBuffer());

  const copiedPages = await mergedPdf.copyPages(
    pdf,
    pdf.getPageIndices()
  );

  copiedPages.forEach((page) => mergedPdf.addPage(page));
};

// Une page A4 par photo, orientée comme la photo, image centrée dans les marges.
const addImagePage = async (mergedPdf: PDFDocument, file: File) => {
  const { bytes, width, height } = await imageToJpeg(file);
  const image = await mergedPdf.embedJpg(bytes);

  const [pageWidth, pageHeight] = width > height ? [A4[1], A4[0]] : A4;

  const scale = Math.min(
    (pageWidth - 2 * PAGE_MARGIN) / width,
    (pageHeight - 2 * PAGE_MARGIN) / height
  );
  const drawWidth = width * scale;
  const drawHeight = height * scale;

  const page = mergedPdf.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
};

export default function Home() {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const nextId = useRef(0);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files) return;

    const seen = new Set(files.map(({ file }) => fileKey(file)));
    const added: SelectedFile[] = [];
    const rejected: string[] = [];

    // L'ordre renvoyé par le navigateur est conservé tel quel, sans tri.
    for (const file of Array.from(event.target.files)) {
      const kind = getKind(file);

      if (!kind) {
        rejected.push(file.name);
        continue;
      }

      if (seen.has(fileKey(file))) continue;
      seen.add(fileKey(file));

      added.push({
        id: String(nextId.current++),
        file,
        kind,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      });
    }

    // Les nouvelles sélections s'ajoutent à la fin au lieu de tout écraser.
    setFiles((current) => [...current, ...added]);

    // Permet de re-sélectionner un fichier qui vient d'être retiré.
    event.target.value = "";

    if (rejected.length > 0) {
      alert(
        `Seuls les PDF et les photos sont acceptés. Fichiers ignorés :\n${rejected.join("\n")}`
      );
    }
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
    const entry = files.find((candidate) => candidate.id === id);
    if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);

    setFiles((current) => current.filter((candidate) => candidate.id !== id));
  };

  const clearFiles = () => {
    files.forEach(({ previewUrl }) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    });

    setFiles([]);
  };

  const mergePDFs = async () => {
    if (files.length < 2) {
      alert("Veuillez sélectionner au moins deux fichiers.");
      return;
    }

    let currentFile: string | null = null;

    try {
      setLoading(true);

      const mergedPdf = await PDFDocument.create();

      for (const { file, kind } of files) {
        currentFile = file.name;

        if (kind === "pdf") {
          await addPdfPages(mergedPdf, file);
        } else {
          await addImagePage(mergedPdf, file);
        }
      }

      currentFile = null;

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
      alert(
        currentFile
          ? `Impossible d'ajouter « ${currentFile} ». Retirez-le et réessayez.`
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-purple-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl p-5 sm:p-8">

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
            accept="application/pdf,image/*"
            multiple
            onChange={handleFileChange}
            className="block w-full rounded-xl border border-pink-300 p-3 file:mr-4 file:rounded-lg file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-white hover:file:bg-pink-600 cursor-pointer"
          />

          <p className="mt-2 text-xs text-gray-400">
            PDF et photos acceptés. Vous pouvez sélectionner vos fichiers en
            plusieurs fois : ils s&apos;ajoutent à la liste.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-pink-50 p-3 sm:p-5 min-h-[150px]">
          {files.length === 0 ? (
            <p className="py-12 text-center text-gray-500">
              Aucun fichier sélectionné
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-semibold text-pink-700">
                  Ordre de fusion
                </h3>

                <button
                  onClick={clearFiles}
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
                {files.map(({ id, file, kind, previewUrl }, index) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 sm:gap-3 rounded-lg bg-white p-2 shadow"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-500 text-xs font-semibold text-white">
                      {index + 1}
                    </span>

                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-pink-100 text-2xl">
                      {kind === "pdf" ? "📄" : "🖼️"}

                      {previewUrl && (
                        <Image
                          src={previewUrl}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover"
                          // Si le navigateur ne sait pas afficher l'aperçu,
                          // l'icône en dessous reste visible.
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {file.name}
                      </span>

                      <span className="block text-xs text-gray-400">
                        {kind === "pdf" ? "PDF" : "Photo"} ·{" "}
                        {(file.size / 1024).toFixed(0)} Ko
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-col">
                      <button
                        onClick={() => moveFile(index, -1)}
                        disabled={index === 0}
                        aria-label={`Déplacer ${file.name} vers le haut`}
                        className="h-7 w-8 rounded text-gray-500 transition hover:bg-pink-100 hover:text-pink-600 disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent"
                      >
                        ↑
                      </button>

                      <button
                        onClick={() => moveFile(index, 1)}
                        disabled={index === files.length - 1}
                        aria-label={`Déplacer ${file.name} vers le bas`}
                        className="h-7 w-8 rounded text-gray-500 transition hover:bg-pink-100 hover:text-pink-600 disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent"
                      >
                        ↓
                      </button>
                    </span>

                    <button
                      onClick={() => removeFile(id)}
                      aria-label={`Retirer ${file.name}`}
                      className="h-10 w-8 shrink-0 rounded text-gray-400 transition hover:bg-pink-100 hover:text-pink-600"
                    >
                      ✕
                    </button>
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
          {loading ? "Fusion en cours..." : "Fusionner"}
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
