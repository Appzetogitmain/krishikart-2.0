import { MapPin, Edit2 } from 'lucide-react';

export default function LocationSummary({
  formattedAddress,
  onChangeLocation,
  required = false,
}) {
  if (!formattedAddress) {
    return (
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
          Business Location {required && '*'}
        </label>
        <button
          type="button"
          onClick={onChangeLocation}
          className="w-full h-12 bg-slate-50 border border-slate-200 rounded-sm outline-none text-xs font-black text-slate-400 hover:bg-white hover:border-slate-900 hover:text-slate-900 transition-all flex items-center justify-center gap-2"
        >
          <MapPin size={16} />
          Select Location on Map
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">
        Business Location {required && '*'}
      </label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-900 transition-colors">
          <MapPin size={16} />
        </div>
        <div className="w-full min-h-[48px] pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-sm text-xs font-black text-slate-900 flex items-center">
          {formattedAddress}
        </div>
        <button
          type="button"
          onClick={onChangeLocation}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-200 rounded-sm transition-colors"
          title="Change location"
        >
          <Edit2 size={14} className="text-slate-600" />
        </button>
      </div>
    </div>
  );
}
