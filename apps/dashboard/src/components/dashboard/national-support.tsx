const gradeColors: Record<"A" | "B" | "C", string> = { A: "#39864a", B: "#e1b619", C: "#e88b2d" };

export function NationalActivityBreakdown() {
  return <p className="rounded-lg bg-surface-muted px-4 py-5 text-sm text-ink-soft">Activity plan totals aren&apos;t available in the connected reporting API yet.</p>;
}

/** D02 v4 national map coloured by current society grade. */
export function NationalSocietyMap({ locations = [] }: { locations?: Array<{ id: string; nameEn: string; societyCode: string; grade: "A" | "B" | "C"; latitude: number; longitude: number; districtName: string }> }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-[#d9edf8] p-3">
      <svg aria-label="Society locations by grade across Sri Lanka" className="mx-auto h-[320px] max-w-full" role="img" viewBox="0 0 250 350">
        <path d="M125 12 112 22 102 21 96 32 83 38 79 50 68 57 75 68 62 76 56 90 61 101 49 113 44 127 53 140 43 153 46 169 36 181 43 197 34 211 43 224 40 239 49 252 51 268 60 280 63 295 75 306 82 321 94 329 106 342 118 337 128 326 138 321 148 310 159 302 166 288 178 279 180 263 190 252 189 236 198 223 192 207 198 193 191 179 195 166 185 153 183 138 172 126 174 112 164 101 158 88 150 76 151 61 144 52 145 39 137 31 137 20Z" fill="#f4f7ef" stroke="#8aa492" strokeWidth="1.5" />
        <path d="M125 12 121 42M78 63 150 68M55 111 174 112M45 160 186 161M39 207 193 207M51 254 180 256M76 302 158 302" fill="none" stroke="#c4d1c6" strokeWidth="1" />
        {locations.map((location) => {
          const cx = 56 + ((location.longitude - 79.5) / 2.6) * 140;
          const cy = 16 + ((9.9 - location.latitude) / 4) * 320;
          return <circle aria-label={`${location.nameEn}, grade ${location.grade}, ${location.districtName}`} cx={cx} cy={cy} fill={gradeColors[location.grade]} key={location.id} r="4" stroke="#fff" strokeWidth="1.5"><title>{location.nameEn} · Grade {location.grade} · {location.districtName}</title></circle>;
        })}
        <g fill="#526057" fontSize="7"><text x="97" y="57">JAFFNA</text><text x="104" y="112">VAVUNIYA</text><text x="61" y="171">KURUNEGALA</text><text x="114" y="199">KANDY</text><text x="159" y="232">BATTICALOA</text><text x="116" y="288">MONARAGALA</text><text x="82" y="323">GALLE</text></g>
      </svg>
      <div className="absolute bottom-3 right-3 rounded-md border border-[#dfe5dc] bg-white/95 p-2 text-[9px] shadow-sm"><strong className="block text-[#344239]">Society grade</strong><p className="mt-1 text-[#526057]">● A · Strong</p><p className="text-[#526057]">● B · Developing</p><p className="text-[#526057]">● C · Needs strengthening</p></div>
      <p className="mt-2 text-[10px] text-[#78857d]">{locations.length ? `${locations.length} registered society locations` : "No society locations are available."}</p>
    </div>
  );
}
