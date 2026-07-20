import { normalizeUploadedAssetUrl } from "@/lib/upload-urls";

export function BrandMark({
  organizationName,
  logoUrl,
}: {
  organizationName: string;
  logoUrl: string | null;
}) {
  const resolvedLogoUrl = normalizeUploadedAssetUrl(logoUrl) ?? logoUrl;

  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        {resolvedLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvedLogoUrl} alt={organizationName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-indigo-700">
            {organizationName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-semibold tracking-tight text-slate-900 leading-none">
          {organizationName}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mt-1">
          Secure Access Portal
        </span>
      </div>
    </div>
  );
}
