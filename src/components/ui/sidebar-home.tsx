import React, { useCallback, useEffect, useState } from "react";
import { useSpineStore } from "@/store/spine-store";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface SpineFile {
  file: File;
  preview: string;
}

export const SpineFileUploader: React.FC = () => {
  const {
    urls,
    setUrls,
    loadSpineAnimation,
    resetStore,
    isLoading,
    error,
    premultipliedAlpha,
    setPremultipliedAlpha,
    files,
    setFiles,
    spine,
  } = useSpineStore();

  const [atlasFile, setAtlasFile] = useState<SpineFile | null>(
    files.atlasFile && urls.atlasUrl
      ? {
          file: files.atlasFile,
          preview: URL.createObjectURL(files.atlasFile),
        }
      : null,
  );

  const [imageFile, setImageFile] = useState<SpineFile | null>(
    files.imageFile && urls.imageUrl
      ? {
          file: files.imageFile,
          preview: URL.createObjectURL(files.imageFile),
        }
      : null,
  );

  const [jsonFile, setJsonFile] = useState<SpineFile | null>(
    files.jsonFile && urls.jsonUrl
      ? {
          file: files.jsonFile,
          preview: URL.createObjectURL(files.jsonFile),
        }
      : null,
  );

  useEffect(() => {
    if (error) {
      toast("Error", {
        description: error,
      });
    }
  }, [error]);

  const readFileAsDataURL = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Reader error."));
      reader.readAsDataURL(file);
    });
  }, []);

  const getFileExtension = useCallback((filename: string): string => {
    return filename.split(".").pop()?.toLowerCase() ?? "";
  }, []);

  const handleFileChange = useCallback(
    async (
      files: File[],
      propertyName: keyof typeof urls,
      setFileFn: React.Dispatch<React.SetStateAction<SpineFile | null>>,
    ) => {
      if (files.length === 0) {
        setFileFn(null);
        setUrls({ [propertyName]: null });
        return;
      }

      const file = files[0];
      try {
        let dataUrl = await readFileAsDataURL(file);

        if (getFileExtension(file.name) === "skel") {
          dataUrl = `${dataUrl}.skel`;
        }

        setFileFn({
          file,
          preview: URL.createObjectURL(file),
        });
        setFiles({ [propertyName.replace("Url", "File")]: file });

        setUrls({ [propertyName]: dataUrl });
      } catch (error) {
        console.error(`Error processing ${propertyName}:`, error);
        toast("File Processing Error", {
          description: `Failed to process ${file.name}`,
        });
      }
    },
    [getFileExtension, readFileAsDataURL, setFiles, setUrls],
  );

  useEffect(() => {
    if (urls.atlasUrl && urls.imageUrl && urls.jsonUrl && !spine) {
      void loadSpineAnimation();
    }
  }, [
    urls.atlasUrl,
    urls.imageUrl,
    urls.jsonUrl,
    loadSpineAnimation,
    premultipliedAlpha,
    spine,
  ]);

  const atlasDropzone = useDropzone({
    accept: {
      "text/plain": [".atlas"],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) =>
      void handleFileChange(acceptedFiles, "atlasUrl", setAtlasFile),
  });

  const imageDropzone = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg"],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) =>
      void handleFileChange(acceptedFiles, "imageUrl", setImageFile),
  });

  const jsonDropzone = useDropzone({
    accept: {
      "application/json": [".json"],
      "application/octet-stream": [".skel"],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) =>
      void handleFileChange(acceptedFiles, "jsonUrl", setJsonFile),
  });

  const handleReset = useCallback(() => {
    if (atlasFile?.preview) URL.revokeObjectURL(atlasFile.preview);
    if (imageFile?.preview) URL.revokeObjectURL(imageFile.preview);
    if (jsonFile?.preview) URL.revokeObjectURL(jsonFile.preview);

    setAtlasFile(null);
    setImageFile(null);
    setJsonFile(null);

    resetStore();

    toast("Reset Complete", {
      description: "All files have been cleared",
    });
  }, [atlasFile, imageFile, jsonFile, resetStore]);

  useEffect(() => {
    return () => {
      if (atlasFile?.preview) URL.revokeObjectURL(atlasFile.preview);
      if (imageFile?.preview) URL.revokeObjectURL(imageFile.preview);
      if (jsonFile?.preview) URL.revokeObjectURL(jsonFile.preview);
    };
  }, [atlasFile, imageFile, jsonFile]);

  return (
    <div className="flex w-48 max-w-48 flex-col space-y-4 p-2">
      {/* Atlas File Dropzone */}
      <div
        {...atlasDropzone.getRootProps()}
        className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed p-2 ${
          atlasDropzone.isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300"
        } ${atlasFile ? "dark:bg-accent border-green-500 bg-green-50" : ""}`}
      >
        <input {...atlasDropzone.getInputProps()} />
        {atlasFile ? (
          <p className="overflow-hidden text-center text-xs text-ellipsis">
            {atlasFile.file.name}
          </p>
        ) : (
          <p className="text-center text-xs">.atlas file</p>
        )}
      </div>

      {/* Image File Dropzone */}
      <div
        {...imageDropzone.getRootProps()}
        className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed p-2 ${
          imageDropzone.isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300"
        } ${imageFile ? "dark:bg-accent border-green-500 bg-green-50" : ""}`}
      >
        <input {...imageDropzone.getInputProps()} />
        {imageFile ? (
          <div className="flex h-full w-full items-center justify-center">
            <img
              src={imageFile.preview}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <p className="text-center text-xs">.png/.jpg file</p>
        )}
      </div>

      {/* JSON/Skel File Dropzone */}
      <div
        {...jsonDropzone.getRootProps()}
        className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed p-2 ${
          jsonDropzone.isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300"
        } ${jsonFile ? "dark:bg-accent border-green-500 bg-green-50" : ""}`}
      >
        <input {...jsonDropzone.getInputProps()} />
        {jsonFile ? (
          <p className="overflow-hidden text-center text-xs text-ellipsis">
            {jsonFile.file.name}
          </p>
        ) : (
          <p className="text-center text-xs">.json/.skel file</p>
        )}
      </div>

      {/* Premultiplied Alpha Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="premultipliedAlpha"
          checked={premultipliedAlpha}
          onCheckedChange={(checked) => {
            setPremultipliedAlpha(checked === true);
            if (urls.atlasUrl && urls.imageUrl && urls.jsonUrl) {
              void loadSpineAnimation();
            }
          }}
        />
        <label htmlFor="premultipliedAlpha" className="text-xs">
          Premultiplied Alpha
        </label>
      </div>

      {/* Reset Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        className="w-full"
        disabled={isLoading}
      >
        {"Reset"}
      </Button>
    </div>
  );
};
