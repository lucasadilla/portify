"use client";

interface ScreenshotGalleryProps {
  urls: string[];
}

export function ScreenshotGallery({ urls }: ScreenshotGalleryProps) {
  if (urls.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Screenshots</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border border-border overflow-hidden hover:opacity-90"
          >
            <img
              src={url}
              alt={`Screenshot ${i + 1}`}
              className="h-32 w-auto object-cover"
            />
          </a>
        ))}
      </div>
    </div>
  );
}
